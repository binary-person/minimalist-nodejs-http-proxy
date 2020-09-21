const http = require('http');
const https = require('https');
const net = require('net');

const port = process.env.PORT || process.argv[2] || 8080;
const verbose = process.argv[3] === 'verbose';

var log = function (data, socket = { end: function () { } }) {
    if(verbose) console.log(data);
    socket.end(data);
};
function getIP(req){
    return (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
}

var server = http.createServer(function (client_req, client_res) {
    var options;
    try {
        options = new URL(client_req.url);
    } catch (e) {
        log('Malformed HTTP request: ' + client_req.url);
        client_res.end('Malformed HTTP request: ' + client_req.url);
        return;
    }
    options.method = client_req.method;
    options.headers = client_req.headers;
    var protocol = options.protocol.slice(0, -1).toUpperCase();

    log(protocol + ' request from ' + getIP(client_req) + ' made a request to ' + client_req.url);

    var proxy;

    if(protocol === 'HTTP'){
        proxy = http.request(options, function (res) {
            client_res.writeHead(res.statusCode, res.headers)
            res.pipe(client_res, {
                end: true
            });
        });
    }else{
        options.rejectUnauthorized = false;
        proxy = https.request(options, function (res) {
            client_res.writeHead(res.statusCode, res.headers)
            res.pipe(client_res, {
                end: true
            });
        });
    }

    proxy.on('error', function (err) {
        log('Errored ' + protocol + ' request while trying to connect to ' + client_req.url + ' ' + err, client_res);
    });
    client_req.on('error', function (err) {
        log('Errored ' + protocol + ' client socket: ' + err);
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
    const serverSocket = net.connect(parsed.port || 80, parsed.hostname, function () {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
            'Proxy-agent: minimalist-nodejs-http-proxy\r\n' +
            '\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
    });
    clientSocket.on('error', function (err) {
        log('Errored CONNECT client socket: ' + err);
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