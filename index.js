const http = require('http');
const https = require('https');
const net = require('net');

const port = process.env.PORT || process.argv[2] || 8080;
const verbose = process.argv[3] === 'verbose';
const username = process.argv[4];
const password = process.argv[5];
const useAuth = username && password;

var log = function (data, socket = { end: function () { } }) {
    if(verbose) console.log(data);
    socket.end(data);
};
function getIP(req){
    return (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
}
function isAuthorized(req){
    if(!useAuth) return true;
    if(req.headers['proxy-authorization']){
        var base64 = req.headers['proxy-authorization'].split('Basic ')[1];
        if(base64){
            try{
                var split = Buffer.from(base64, 'base64').toString('utf8').split(':');
                if(split[0] === username && split[1] === password) return true;
            }catch(e){}
        }
    }
    return false;
}

var server = http.createServer(function (client_req, client_res) {
    var options;
    try {
        options = new URL(client_req.url);
    } catch (e) {
        log('Malformed HTTP request: ' + client_req.url, client_res);
        return;
    }
    options.method = client_req.method;
    options.headers = client_req.headers;

    var protocol = options.protocol.slice(0, -1).toUpperCase();
    log(protocol + ' request from ' + getIP(client_req) + ' made a request to ' + client_req.url);

    client_req.on('error', function (err) {
        log('Errored ' + protocol + ' client socket: ' + err);
    });

    if(!isAuthorized(client_req)){
        client_res.writeHead(407, {
            'Proxy-Authenticate': 'Basic realm="lmao"',
            'Proxy-agent': 'minimalist-nodejs-http-proxy'
        });
        log('Unauthorized HTTP request from ' + getIP(client_req) + ': ' + client_req.url, client_res);
        return;
    }

    var proxy;

    if(protocol === 'HTTP'){
        proxy = http.request(options, function (res) {
            res.headers['Proxy-agent'] = 'minimalist-nodejs-http-proxy';
            client_res.writeHead(res.statusCode, res.headers)
            res.pipe(client_res, {
                end: true
            });
        });
    }else{
        options.rejectUnauthorized = false;
        proxy = https.request(options, function (res) {
            res.headers['Proxy-agent'] = 'minimalist-nodejs-http-proxy';
            client_res.writeHead(res.statusCode, res.headers)
            res.pipe(client_res, {
                end: true
            });
        });
    }

    proxy.on('error', function (err) {
        log('Errored ' + protocol + ' request while trying to connect to ' + client_req.url + ' ' + err, client_res);
    });
    client_req.pipe(proxy, {
        end: true
    });
});
server.on('connect', function (req, clientSocket, head) {
    var parsed;
    if(req.url.includes('::')) req.url = '[' + req.url + ']';
    try {
        parsed = new URL('http://' + req.url);
    }catch(e) {
        clientSocket.write('HTTP/1.1 400 Bad Request\r\n' +
            'Proxy-agent: minimalist-nodejs-http-proxy\r\n' +
            '\r\n');
        log('Malformed CONNECT request: ' + req.url, clientSocket);
        return;
    }

    log('CONNECT request from ' + getIP(req) + ' made a request to ' + parsed.hostname);
    clientSocket.on('error', function (err) {
        log('Errored CONNECT client socket: ' + err);
    });
    if(!isAuthorized(req)){
        clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\n' +
            'Proxy-agent: minimalist-nodejs-http-proxy\r\n' +
            'Proxy-Authenticate: Basic realm="lmao"\r\n' +
            '\r\n');
        log('Unauthorized CONNECT request from ' + getIP(req) + ': ' + req.url, clientSocket);
        return;
    }

    const serverSocket = net.connect(parsed.port || 80, parsed.hostname, function () {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
            'Proxy-agent: minimalist-nodejs-http-proxy\r\n' +
            '\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
    });
    serverSocket.on('error', function (err) {
        clientSocket.write('HTTP/1.1 500 Internal Server Error\r\n' +
            'Proxy-agent: minimalist-nodejs-http-proxy\r\n' +
            '\r\n');
        log('Errored CONNECT request while trying to connect to ' + parsed.hostname + ' on port ' + (parsed.port || 80) + ': ' + err, clientSocket);
    });
});
server.listen(port, null, null, function () {
    console.log('Minimalist Nodejs HTTP Proxy listening on port ' + port)
});