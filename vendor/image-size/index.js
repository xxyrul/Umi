"use strict";

const fs = require("fs");

function unsupported(type) {
  throw new TypeError(`unsupported file type: ${type || "unknown"}`);
}

function jpegSize(data) {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > data.length) break;

    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) break;

    const isFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isFrame && length >= 7) {
      return {
        height: data.readUInt16BE(offset + 3),
        width: data.readUInt16BE(offset + 5),
        type: "jpg",
      };
    }
    offset += length;
  }
  unsupported("jpg");
}

function imageSize(input) {
  const data =
    input instanceof Uint8Array
      ? Buffer.from(input)
      : fs.readFileSync(input);

  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return {
      width: data.readUInt32BE(16),
      height: data.readUInt32BE(20),
      type: "png",
    };
  }

  if (data.length >= 10 && data.toString("ascii", 0, 3) === "GIF") {
    return {
      width: data.readUInt16LE(6),
      height: data.readUInt16LE(8),
      type: "gif",
    };
  }

  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    const subtype = data.toString("ascii", 12, 16);
    if (subtype === "VP8X" && data.length >= 30) {
      return {
        width: 1 + data[24] + (data[25] << 8) + (data[26] << 16),
        height: 1 + data[27] + (data[28] << 8) + (data[29] << 16),
        type: "webp",
      };
    }
    if (subtype === "VP8 " && data.length >= 30 && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
      return {
        width: data.readUInt16LE(26) & 0x3fff,
        height: data.readUInt16LE(28) & 0x3fff,
        type: "webp",
      };
    }
    unsupported("webp");
  }

  if (data.length >= 26 && data.toString("ascii", 0, 2) === "BM") {
    return {
      width: Math.abs(data.readInt32LE(18)),
      height: Math.abs(data.readInt32LE(22)),
      type: "bmp",
    };
  }

  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8) {
    return jpegSize(data);
  }

  // Do not parse JXL/HEIF boxes: their zero-length box handling is the
  // vulnerability fixed by the upstream image-size PR that is not released.
  unsupported("image");
}

module.exports = imageSize;
module.exports.default = imageSize;