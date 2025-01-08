# TLDR:

The new magic method is ~4x slower than the raw server. This is mostly due to creating new Request/Response/Header objects in each loop.
In absolute terms, this is irrelevant.
```sh 
./main.js

# Test all endpoints are alive
curl http://localhost:42001 -v
curl --http1.1 --insecure https://localhost:42002 -v
curl --http2   --insecure https://localhost:42002 -v

# Test magic connection
curl http://localhost:43001 -v
curl --http1.1 --insecure https://localhost:43002 -v
curl --http2   --insecure https://localhost:43002 -v


# Run bombardier on vanilla
~/go/bin/bombardier --insecure --latencies -c 10 -n 100000 --http1 http://localhost:42001/plain-http1
~/go/bin/bombardier --insecure --latencies -c 10 -n 100000 --http1 https://localhost:42002/tls-http1.1
~/go/bin/bombardier --insecure --latencies -c 10 -n 100000 --http2 https://localhost:42002/tls-http2

# Run bombardier on magic
~/go/bin/bombardier --insecure --latencies -c 10 -n 100000 --http1 http://localhost:43001/plain-http1
~/go/bin/bombardier --insecure --latencies -c 10 -n 100000 --http1 https://localhost:43002/tls-http1.1
~/go/bin/bombardier --insecure --latencies -c 10 -n 100000 --http2 https://localhost:43002/tls-http2

```