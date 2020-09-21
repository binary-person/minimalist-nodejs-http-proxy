# Minimalist Nodejs HTTP Proxy

## Reason for making this Proxy
After a treacherous search of the internet, the only easy-to-use proxies I've been able to find is Anyproxy. Although there are fast light proxies like Tinyproxy, they either need a lot of trouble to install and configure the daemon or have too much configurations that make it confusing.

Node.js's asynchronous API enables this proxy to have many connections without overloading the proxy server.

## Prerequisites
Only `node`. Nothing else required. Not even `npm install`.

## Usage
Syntax:
```
node index.js PORT ?verbose ?username ?password
```

An example of the proxy server running on port 8000 without verbose would be
```
node index.js 8000
```

An example of the proxy server running on port 8888 with verbose would be
```
node index.js 8888 verbose
```

An example of the proxy server running on port 8888 without verbose with authentication would be
```
node index.js 8888 noverbose myusername mypassword
```

