# Slack tipping bot using LN for payments

## Installation


### Requirements

* [Git](https://git-scm.com/)
* [NodeJS 8.x/ npm](https://nodejs.org)

### Procedure

Fetch sources from the git repository:

```
git clone https://github.com/CryptoFR/ln-tip-slack.git
```
Move into the newly created directory:

```
cd lncli-web
```

Fetch the dependencies and build the application by running:

```
npm install
```

If not started automatically, run the following command to build the application:

```
"./node_modules/.bin/gulp" bundle
```

## Execution

### Requirements

`lncli-web` is now fully compatible with macaroons and encrypted wallets.

But if you want to start `lnd` with wallet encryption and macaroons disabled, just add those two parameters to the command line:

```
lnd [...] --no-macaroons --noencryptwallet
```

If you want to use macaroons, you need to copy the `lnd` `admin.macaroon` file to the `lncli-web` root directory (by default).  The default path to the `admin.macaroon` file can be modified in the `<lncliweb>/config/defaults.js` file.

### Generate lnd certificates compatible with NodeJS gRPC

Beware that lnd autogenerated certificates are not compatible with current NodeJS gRPC module implementation.

Lnd uses the `P-521` curve for its certificates but NodeJS gRPC module is only compatible with certificates using the `P-256` curve ([link](https://github.com/grpc/grpc/issues/6722#issuecomment-320348094)).

You need to generate your own lnd certificates using the following commands (thanks to Alex Akselrod for helping me on this):

```
# Enter the Lnd home directory, located by default at ~/.lnd on Linux or 
# /Users/[username]/Library/Application Support/Lnd/ on Mac OSX
# $APPDATA/Local/Lnd on Windows. Also change '/CN=localhost/O=lnd' to '//CN=localhost\O=lnd' if you are using Git Bash.
cd ~/.lnd
openssl ecparam -genkey -name prime256v1 -out tls.key
openssl req -new -sha256 -key tls.key -out csr.csr -subj '/CN=localhost/O=lnd'
openssl req -x509 -sha256 -days 36500 -key tls.key -in csr.csr -out tls.cert
rm csr.csr
```


### Copy generated certificate file into lncli-web directory

cp tls.cert [lncli-web_directory]/lnd.cert

### Start the Webserver

```
node server
```

Available command-line arguments:

```
node server --help

  Usage: server [options]

  Options:

    -h, --help                    output usage information
    -V, --version                 output the version number
    -s, --serverport [port]       web server listening port (defaults to 8280)
    -h, --serverhost [host]       web server listening host (defaults to localhost)
    -l, --lndhost [host:port]     RPC lnd host (defaults to localhost:10009)
    -t, --usetls [path]           path to a directory containing key.pem and cert.pem files
    -u, --user [login]            basic authentication login
    -p, --pwd [password]          basic authentication password
    -r, --limituser [login]       basic authentication login for readonly account
    -w, --limitpwd [password]     basic authentication password for readonly account
    -f, --logfile [file path]     path to file where to store the application logs
    -e, --loglevel [level]        level of logs to display (debug, info, warn, error)
    -n, --lndlogfile <file path>  path to lnd log file to send to browser
    -k, --le-email [email]        lets encrypt required contact email

```

Open your browser at the following address: [http://localhost:8280](http://localhost:8280)

If you want to access `lncli-web` using a domain, add the `--serverhost` flag like so:

 ```
 node server --serverhost <yourdomain>
 ```
 Open your browser at the following addres:
 [http://yourdomain:8280](http://yourdomain:8280)

 Enjoy!



#### Build the container
(from inside the lncli-web folder)
```
docker build . -t lncli-web
```

#### Run in a Docker container
Mount your .lnd directory to the container:

```
docker run -v /path/to/.lnd/:/config lncli-web
```

The container will generate certs if necessary.

Any commandline option (see below) can be overridden by setting an appropriate environment variable.

Example: set `SET_LNDHOST` for `--lndhost`, or set `SET_LE_EMAIL` for `--le-email`

#### Running in a Docker container connecting to a remote LND instance
Copy the admin.macaroon, tls.key and tls.cert to your machine, for example in /tmp/config.

Then, use `docker run` accordingly:
```
docker run -it -e SET_LNDHOST=[IP of lightning host]:10009 -v /tmp/config:/config --net=host lncli-web
```
Then just browse to http://127.0.0.1:8280. Note: this still requires you to re-generate your certificates as per above.

## Screenshots

Check here for the mandatory screenshots: [http://imgur.com/a/LgWcs](http://imgur.com/a/LgWcs)

## Enabling https for remote access

You need to have a `key.pem` (private key) file and a `cert.pem` (certificate) file available in your path (check the --usetls command-line option).

On Linux you can create the above files using a self-signed certificate by executing the following command:

```
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 36500
```

You might need to run this extra command to remove the password protection:

```
openssl rsa -in key.pem -out newkey.pem && mv newkey.pem key.pem
```

And the you need to add the `--usetls` command-line option to point to the directory containing your two `pem` files.

Example command starting a password protected Lnd Web Client with readonly account enabled, running on port 443, and using https with corresponding `pem` files located in the app directory:

```
node server -s 443 --usetls . --user manager --pwd 33H966wG --limituser lnd --limitpwd rocks
```

Hoping that helps.

## Network graph

The lightning network graph rendering functionality requires to have `graphviz` installed on the server.