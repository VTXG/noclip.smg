use binrw::prelude::*;
use wasm_bindgen::prelude::wasm_bindgen;
use js_sys::*;
use serde::*;
use wasm_bindgen::JsValue;
use std::io::SeekFrom;
use std::io::Cursor;
use std::collections::BTreeMap;

#[wasm_bindgen]
#[derive(BinRead, BinWrite, Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[brw(big)]
pub struct CAMNHeader {
    #[brw(little)]
    pub magic: u32,
    #[brw(little)]
    pub frame_type: FrameType,
    pub unk1: i32,
    pub unk2: i32,
    pub unk3: i32,
    pub unk4: i32,
    pub frame_count: i32,
    pub offset: u32
}

#[wasm_bindgen]
#[derive(BinRead, BinWrite, Clone, Copy, Debug, PartialEq, Eq)]
#[brw(repr = u32)]
pub enum FrameType {
    CANM = 1296974147,
    CKAN = 1312901955
}

impl Serialize for FrameType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: Serializer {
        (*self as u32).serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for FrameType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de> {
        let val = u32::deserialize(deserializer)?;
        Ok(unsafe {std::mem::transmute(val)})
    }
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
pub struct Frame {
    pub frameid: f32,
    pub value: f32,
    pub inslope: f32,
    pub outslope: f32
}

impl Frame {
    #[inline]
    pub const fn new() -> Frame {
        Frame { frameid: 0f32, value: 0f32, inslope: 0f32, outslope: 0f32 }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Track {
    pub values: Vec<Frame>,
    pub usesinglescope: bool
}

impl Track {
    pub fn load<R: BinReaderExt>(reader: &mut R, pos: u64, iscamn: bool) -> BinResult<Self> {
        let mut result = Self::default();
        let filecount = i32::read_be(reader)?;
        let start = i32::read_be(reader)? as u64;
        if !iscamn {
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
            if iscamn {
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CAMN {
    pub header: CAMNHeader,
    pub tracks: BTreeMap<TrackSelection, Track>,
    pub isfullframes: bool
}

impl CAMN {
    pub fn load<R: BinReaderExt>(reader: &mut R) -> BinResult<Self> {
        let start = reader.stream_position()?;
        let header = CAMNHeader::read_be(reader)?;
        let mut result = Self {header, tracks: BTreeMap::new(), isfullframes: false};
        result.isfullframes = result.header.frame_type == FrameType::CANM;
        let offset = header.offset as u64;
        for suit in TrackSelection::new() {
            result.tracks.insert(suit, Track::load(reader, start + 0x20 + offset, result.isfullframes)?);
        }
        Ok(result)
    }
}

#[wasm_bindgen]
pub fn camn_to_js(path: &str) -> Result<JsValue, JsValue> {
    match std::fs::read(path) {
        Ok(data) => {
            let mut cursor = Cursor::new(data);
            match CAMN::load(&mut cursor) {
                Ok(camn) => {
                    match serde_wasm_bindgen::to_value(&camn) {
                        Ok(value) => Ok(value),
                        Err(e) => Err(e.into())
                    }
                },
                Err(e) => Err(JsValue::from_str(&e.to_string()))
            }
        }
        Err(e) => Err(JsValue::from_str(&e.to_string()))
    }
}