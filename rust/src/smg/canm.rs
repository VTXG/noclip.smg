use binrw::prelude::*;
use wasm_bindgen::prelude::*;
use js_sys::*;
use serde::*;
use std::io::SeekFrom;
use std::io::Cursor;
use std::collections::BTreeMap;

#[wasm_bindgen]
#[derive(BinRead, BinWrite, Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[brw(big)]
pub struct CANMHeader {
    #[brw(little)]
    pub magic: CANMMagic,
    #[brw(little)]
    pub frame_type: FrameType,
    pub unk1: i32,
    pub unk2: i32,
    pub unk3: i32,
    pub unk4: i32,
    pub frame_count: i32,
    pub offset: u32
}

#[wasm_bindgen(js_class = "CANMHeader")]
impl CANMHeader {
    #[inline]
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { magic: CANMMagic::ANDO, frame_type: FrameType::CANM, unk1: 0, unk2: 0, 
        unk3: 0, unk4: 0, frame_count: 0, offset: 0 }
    }
}

#[wasm_bindgen]
#[derive(BinRead, BinWrite, Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[brw(repr = u32)]
pub enum CANMMagic {
    ANDO = 0x4F444E41
}

#[wasm_bindgen]
#[derive(BinRead, BinWrite, Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[brw(repr = u32)]
pub enum FrameType {
    CANM = 0x4D4E4143,
    CKAN = 0x4E414B43
}

#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[repr(u32)]
pub enum TrackSelection {
    PositionX,
    PositionY,
    PositionZ,
    TargetX,
    TargetY,
    TargetZ,
    Roll,
    FieldOfView
}

impl TrackSelection {
    #[inline]
    pub const fn new() -> [TrackSelection; 8] {
        let mut items = [TrackSelection::PositionX; 8];
        let mut i = 0;
        while i != items.len() {
            unsafe { items[i] = std::mem::transmute(i as u32); }
            i += 1;
        }
        items
    }
}

#[derive(Debug, Default, Clone, Copy, PartialEq, PartialOrd, BinRead, BinWrite, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Frame {
    pub frameid: f32,
    pub value: f32,
    pub inslope: f32,
    pub outslope: f32
}

#[wasm_bindgen(js_class = "Frame")]
impl Frame {
    #[inline]
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Frame { frameid: 0f32, value: 0f32, inslope: 0f32, outslope: 0f32 }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Track {
    pub values: Vec<Frame>,
    pub usesinglescope: bool
}

impl Track {
    pub fn load<R: BinReaderExt>(reader: &mut R, pos: u64, iscanm: bool) -> BinResult<Self> {
        let mut result = Self::default();
        let filecount = i32::read_be(reader)?;
        let start = i32::read_be(reader)? as u64;
        if !iscanm {
            result.usesinglescope = i32::read_be(reader)? == 0;
        }
        let restore = reader.stream_position()?;
        reader.seek(SeekFrom::Start(pos + 0x04 + (0x04 * start)))?;
        for i in 0..filecount {
            let mut frame = Frame::new();
            if filecount == 1 {
                frame.value = reader.read_be()?;
                result.values.push(frame);
                continue;
            }
            if iscanm {
                frame.frameid = i as _;
                frame.value = reader.read_be()?;
            } else {
                frame.frameid = reader.read_be()?;
                frame.value = reader.read_be()?;
                frame.inslope = reader.read_be()?;
                if !result.usesinglescope {
                    frame.outslope = reader.read_be()?;
                }
            }
            result.values.push(frame);
        }
        reader.seek(SeekFrom::Start(restore))?;
        Ok(result)
    }
    pub fn save<W: BinWriterExt>(&self, writer: &mut W, data: &mut Vec<f32>, iscanm: bool) -> BinResult<()> {
        let mut mydata = Vec::<f32>::new();
        for i in 0..self.values.len() {
            let cur = self.values[i];
            if self.values.len() == 1 {
                mydata.push(cur.value);
                continue;
            }
            if iscanm {
                mydata.push(cur.value);
            } else {
                mydata.push(cur.frameid);
                mydata.push(cur.value);
                mydata.push(cur.inslope);
                if !self.usesinglescope {
                    mydata.push(cur.outslope);
                }
            }
        }
        let index = data.windows(mydata.len()).position(|x| x == mydata);
        let mut index = match index {
            Some(index) => index as i32,
            None => -1
        };
        if index == -1 {
            index = data.len() as i32;
            data.extend_from_slice(&mydata);
        }
        writer.write_be(&(data.len() as i32))?;
        writer.write_be(&index)?;
        if !iscanm {
            writer.write_be(&(self.usesinglescope as i32))?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CANM {
    pub header: CANMHeader,
    pub tracks: BTreeMap<TrackSelection, Track>,
    pub isfullframes: bool
}

impl CANM {
    pub fn load<R: BinReaderExt>(reader: &mut R) -> BinResult<Self> {
        let start = reader.stream_position()?;
        let header = CANMHeader::read_be(reader)?;
        let mut result = Self {header, tracks: BTreeMap::new(), isfullframes: false};
        result.isfullframes = result.header.frame_type == FrameType::CANM;
        let offset = header.offset as u64;
        for suit in TrackSelection::new() {
            result.tracks.insert(suit, Track::load(reader, start + 0x20 + offset, result.isfullframes)?);
        }
        Ok(result)
    }
    pub fn save<W: BinWriterExt>(&self, writer: &mut W) -> BinResult<()> {
        writer.write_le(&CANMMagic::ANDO)?;
        let camtype = match self.isfullframes {
            true => FrameType::CANM,
            false => FrameType::CKAN
        };
        writer.write_le(&camtype)?;
        let CANMHeader {unk1, unk2, unk3, unk4, frame_count, ..} = self.header;
        let full = match self.isfullframes {
            true => 0x40,
            false => 0x60
        };
        writer.write_be(&unk1)?;
        writer.write_be(&unk2)?;
        writer.write_be(&unk3)?;
        writer.write_be(&unk4)?;
        writer.write_be(&frame_count)?;
        writer.write_be(&full)?;
        let mut frame_data = vec![];
        for suit in TrackSelection::new() {
            self.tracks[&suit].save(writer, &mut frame_data, self.isfullframes)?;
        }
        let smth = (frame_data.len() as i32 + 2) * 4;
        writer.write_be(&smth)?;
        writer.write_be(&frame_data)?;
        let unk_data = vec![0x3Du8, 0xCC, 0xCC, 0xCD, 0x4E, 0x6E, 0x6B, 0x28, 0xFF, 0xFF, 0xFF, 0xFF];
        writer.write(&unk_data)?;
        Ok(())
    }
}

#[wasm_bindgen]
pub fn canm_to_js(data: &[u8]) -> Result<JsValue, JsValue> {
    let mut cursor = Cursor::new(data);
    match CANM::load(&mut cursor) {
        Ok(canm) => {
            match serde_wasm_bindgen::to_value(&canm) {
                Ok(value) => Ok(value),
                Err(e) => Err(e.into())
            }
        },
        Err(e) => Err(JsValue::from_str(&e.to_string()))
    }
}

#[wasm_bindgen]
pub fn js_canm_to_bytes(data: JsValue) -> Result<Vec<u8>, JsValue> {
    match serde_wasm_bindgen::from_value::<CANM>(data) {
        Ok(canm) => {
            let mut cursor = Cursor::new(vec![]);
            match canm.save(&mut cursor) {
                Ok(_) => Ok(cursor.into_inner()),
                Err(e) => Err(JsValue::from_str(&e.to_string()))
            }
        },
        Err(e) => Err(e.into())
    }
}
    