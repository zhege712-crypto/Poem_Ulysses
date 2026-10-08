// Shared, dependency-free date precision and writing-information rules.
globalThis.PoemWritingFactory = function () {
  function invalid(message, field) { const e = new Error(message); e.status = 400; e.field = field; throw e; }
  function range(value, field) {
    if (!value) return null;
    if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) invalid('请使用年份、年月或年月日，例如 2026、2026-03、2026-03-08。', field);
    const [y, m, d] = value.split('-').map(Number);
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (!y || (m !== undefined && (m < 1 || m > 12)) || (d !== undefined && (d < 1 || d > days[m - 1]))) invalid('请填写有效日期；不确定月或日时可以只填写年份或年月。', field);
    return [y * 10000 + (m || 1) * 100 + (d || 1), y * 10000 + (m || 12) * 100 + (d || days[(m || 12) - 1])];
  }
  function normalize(value) {
    if (value === undefined || value === null || value === '') value = {};
    if (typeof value !== 'object' || Array.isArray(value)) invalid('写作信息格式错误。', 'start');
    const result = {};
    for (const key of ['start', 'end', 'place']) {
      if (value[key] !== undefined && typeof value[key] !== 'string') invalid('写作信息须使用普通文字。', key);
      result[key] = (value[key] || '').trim();
    }
    if (value.public !== undefined && typeof value.public !== 'boolean') invalid('请确认写作信息的公开选项。', 'public');
    result.public = value.public === true;
    const start = range(result.start, 'start'), end = range(result.end, 'end');
    if (start && end && start[0] > end[1]) invalid('完稿日期明确早于起稿日期，请核对；可以保留年月或年份的精度。', 'end');
    if (result.place.length > 200 || /[\u0000-\u001f\u007f<>]/.test(result.place)) invalid('写作地点最多 200 字，请用普通文字；多个地点可用顿号分隔。', 'place');
    return result;
  }
  function text(value) {
    const w = normalize(value);
    return [w.start && '起稿于 ' + w.start, w.end && '完稿于 ' + w.end, w.place && '写于 ' + w.place].filter(Boolean).join(' · ');
  }
  function publicValue(value) {
    const w = normalize(value);
    if (!w.public || !text(w)) return undefined;
    return Object.fromEntries(['start', 'end', 'place'].filter(k => w[k]).map(k => [k, w[k]]));
  }
  return { normalize, range, text, publicValue };
};
globalThis.PoemWriting = globalThis.PoemWritingFactory();
