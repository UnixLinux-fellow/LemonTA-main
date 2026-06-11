/**
 * 柜体布置算法 — 纯函数
 *
 * 沿墙宽方向依次贴墙排列柜子，末位为非标柜并预留 4cm 收口。
 * 与 Three.js 完全解耦，便于测试。
 */

var END_FILLER_CM = 4;
var MIN_CUSTOM_WIDTH_CM = 8;
var STANDARD_WIDTHS_CM = [50, 100];
var MIN_STANDARD_WIDTH_CM = 50;

function cloneList(list) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    out.push({
      widthCm: m.widthCm,
      isCustom: m.isCustom,
      wallStartCm: m.wallStartCm,
      scale: { x: m.scale.x, y: m.scale.y, z: m.scale.z }
    });
  }
  return out;
}

function sumStandardWidths(list) {
  var sum = 0;
  for (var i = 0; i < list.length; i++) {
    if (!list[i].isCustom) sum += list[i].widthCm;
  }
  return sum;
}

function hasTrailingCustom(list) {
  return list.length > 0 && list[list.length - 1].isCustom;
}

function recomputePositions(list) {
  var x = 0;
  for (var i = 0; i < list.length; i++) {
    list[i].wallStartCm = x;
    x += list[i].widthCm;
  }
}

function addStandard(list, widthCm, wallWidthCm) {
  var copy = cloneList(list);
  if (hasTrailingCustom(copy)) {
    return { added: false, list: copy, error: 'finalized' };
  }
  var used = sumStandardWidths(copy);
  if (used + widthCm + END_FILLER_CM > wallWidthCm) {
    return { added: false, list: copy, error: 'no-space' };
  }
  copy.push({
    widthCm: widthCm,
    isCustom: false,
    wallStartCm: used,
    scale: { x: 1, y: 1, z: 1 }
  });
  return { added: true, list: copy };
}

function finalize(list, wallWidthCm) {
  var copy = cloneList(list);
  if (hasTrailingCustom(copy)) copy.pop();
  var used = sumStandardWidths(copy);
  var customW = wallWidthCm - used - END_FILLER_CM;
  if (customW < MIN_CUSTOM_WIDTH_CM) {
    return { list: null, error: 'remaining-too-small' };
  }
  copy.push({
    widthCm: customW,
    isCustom: true,
    wallStartCm: used,
    scale: { x: 1, y: 1, z: 1 }
  });
  return { list: copy };
}

function removeAt(list, index, wallWidthCm) {
  var copy = cloneList(list);
  if (index < 0 || index >= copy.length) {
    return { list: copy, error: 'out-of-range' };
  }
  var removedWasCustom = copy[index].isCustom;
  copy.splice(index, 1);
  if (!removedWasCustom && hasTrailingCustom(copy)) {
    copy.pop();
    var used = sumStandardWidths(copy);
    var newCustomW = wallWidthCm - used - END_FILLER_CM;
    if (newCustomW >= MIN_CUSTOM_WIDTH_CM) {
      copy.push({
        widthCm: newCustomW,
        isCustom: true,
        wallStartCm: used,
        scale: { x: 1, y: 1, z: 1 }
      });
    }
  }
  recomputePositions(copy);
  return { list: copy };
}

function canFitWall(wallWidthCm) {
  return wallWidthCm >= MIN_STANDARD_WIDTH_CM + END_FILLER_CM;
}

module.exports = {
  addStandard: addStandard,
  finalize: finalize,
  removeAt: removeAt,
  canFitWall: canFitWall,
  END_FILLER_CM: END_FILLER_CM,
  MIN_CUSTOM_WIDTH_CM: MIN_CUSTOM_WIDTH_CM,
  STANDARD_WIDTHS_CM: STANDARD_WIDTHS_CM
};
