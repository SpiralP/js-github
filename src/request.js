var https = require('https');
module.exports = function (root, accessToken) {
  var cache = {};


  return function request(method, url, body, callback) {
    if (typeof body === "function" && callback === undefined) {
      callback = body;
      body = undefined;
    }
    if (!callback) return request.bind(this, accessToken, method, url, body);
    url = url.replace(":root", root);

    var json;
    var headers = {
      "User-Agent": "node.js"
    };
    if (accessToken) {
      headers["Authorization"] = "token " + accessToken;
    }
    if (body) {
      headers["Content-Type"] = "application/json";
      try { json = JSON.stringify(body); }
      catch (err) { return callback(err); }
    }
    if (method === "GET") {
      var cached = cache[url];
      if (cached) {
        headers["If-None-Match"] = cached.etag;
      }
    }
    var options = {
      hostname: "api.github.com",
      path: url,
      method: method,
      headers: headers
    };
    var req = https.request(options, function (res) {
      var response;
      var body = [];
      res.on("data", function (chunk) {
        body.push(chunk);
      });
      res.on("end", function () {
        body = Buffer.concat(body).toString();
        console.log(method, url, res.statusCode);
        console.log("Rate limit %s/%s left", res.headers['x-ratelimit-remaining'], res.headers['x-ratelimit-limit']);
        if (res.statusCode >= 400 && res.statusCode < 500) return callback();
        else if (res.statusCode === 200 && method === "GET" && /\/refs\//.test(url)) {
          cache[url] = {
            body: body,
            etag: res.headers.etag
          };
        }
        else if (res.statusCode === 304) {
          body = cache[url].body;
        }
        else if (res.statusCode < 200 || res.statusCode >= 300) {
          return callback(new Error("Invalid HTTP response: " + res.statusCode));
        }
        if (body) {
          try { response = JSON.parse(body); }
          catch (err) { return callback(err); }
        }
        return callback(null, response);
      });
    });
    req.end(json);
    req.on("error", callback);
  };
};
