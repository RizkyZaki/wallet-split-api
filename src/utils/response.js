// Every response uses the same envelope so clients can branch on `success`
// without inspecting the HTTP status first.
function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, message, status) {
  return res.status(status).json({ success: false, error: message });
}

module.exports = { ok, fail };
