const vscode = require('vscode');
const WSS = require('ws').Server;
const irc = require('irc');

/**
 * @param {vscode.ExtensionContext} context
 */

function activate(context) {

	vscode.commands.registerCommand('IRC.start', () => {
		const panel = vscode.window.createWebviewPanel(
			'VSIRC',
			'IRC CLIENT',
			vscode.ViewColumn.One,
			{enableScripts: true}
		);

		panel.webview.html = getWebviewContent();

		//starting a websocket server
		const wss = new WSS({ port: 8080 })


		//some global vars used by the client
		var client;
		var channel = "";
		var nick = "";
		var _channellist;

		wss.on('connection', ws => {

			//cool banner
			ws.send(`
██╗██████╗░░█████╗░
██║██╔══██╗██╔══██╗
██║██████╔╝██║░░╚═╝
██║██╔══██╗██║░░██╗
██║██║░░██║╚█████╔╝
╚═╝╚═╝░░╚═╝░╚════╝░

--------------------------------------------
to connect to a server type /connect IP NICK |
to disconnect from a server type /disconnect |
--------------------------------------------
`);



			//when user enters a message
			ws.on('message', message => {

				//if user connects to a IRC chat
				if(message.toString().includes("/connect".toLowerCase())) {
					ws.send(message)
					//connect
					var data = message.toString().split(" ")

					nick = data[2];

					ws.send("Connecting to " + data[1])
					client = new irc.Client(data[1], data[2], {
						channels: [], realName: "VScode IRC", stripColors: false
					});

					//when user gets registered to a new server
					client.addListener('registered', function(message) {
						ws.send("Connected")
					});

					//when server returns a motd
					client.addListener('motd', function(motd) {
						ws.send(motd)
					});

					//when server returns a topic
					client.addListener('topic', function(channel, topic, nick, message) {
						ws.send(nick + ' => ' + channel + ': ' + topic)
					});

					//when channelist starts to download
					client.addListener('channellist_start', function(list) {
						_channellist = Array()
						ws.send("Downloading channellist")
					});

					//adding channelist listing to an array
					client.addListener('channellist_item', function(listing) {
						_channellist.push(listing);
					});

					//sorting and returning channelist when download is complete
					client.addListener('channellist', function(list) {
						_channellist.sort(function(a,b) {
							return a["users"]-b["users"]
						});

						list = "";
						_channellist.forEach(element => {
							list += element["name"] + " : " + element["users"] + " : " + element["topic"] + "<br>"
						});
						ws.send(list);
					});

					//ignoring errors
					client.addListener('error', function(message) {
						//ws.send('error: ', message);
					});

					//returning message
					client.addListener('message', function (from, to, message) {
						ws.send(from + ' => ' + to + ': ' + message);
					});
				}


				// 
				// Handling commands
				//

				//if user wants to join a channel
				if(message.toString().includes("/join".toLowerCase())) {
					//connect
					ws.send(message)
					var data = message.toString().split(" ")

					client.join(data[1]);
					channel = data[1];
				}

				//if user wants to disconnect from a channel
				if(message.toString().includes("/disconnect".toLowerCase())) {
					//connect
					ws.send(message)
					client.disconnect();
				}

				//if user wants a channel list
				if(message.toString().includes("/list".toLowerCase())) {
					client.list();
				}

				//handling everything that dosent contain a "/" 
				// TODO: Make sure it only registers when the "/" is at the start of a sentence
				if(!message.toString().includes("/")) {
					ws.send(nick + ' => ' + channel + ': ' + message)
					try {
						client.say(channel, message.toString());
					} catch {
						ws.send("error: Try connecting to an irc chat first.")
					}
				}
			})
		})
	});
}


//returning faketerminal interface
function getWebviewContent() {
	return `<!--
    Todo: beutyfy HTML and JS
-->
<!doctype html>
<html>
    <head>
		<style>
			html, body {
				max-width: 100%;
				overflow-x: hidden;
			}
            body {
				margin: 0;
            }
            p {
                margin: 0px;
			}
            #terminal {
				overflow-x: hidden;
                position: absolute;
                overflow-y: auto;
                width: 100%; 
				height: 98%;
				top: 0px;
				max-width: 100%;
				word-wrap: break-word
            }
        </style>
    </head>
    <body>
		<div>
			<pre>
				<div id="terminal"> 

				</div>
			</pre>
            <input type="text" id="terminalI" style="position: absolute; bottom: 0px; width: 100%; border: 0; outline: none; background-color: rgba(255, 0, 0, 0); color: white" value="">
        </div>
    </body>
    <script>
        const connection = new WebSocket('ws://localhost:8080')

        terminal = document.getElementById("terminal")

        connection.onmessage = e => {
            terminal.innerHTML += "<p>" + e.data + "</p>"
            terminal.scrollTop = terminal.scrollHeight;
        }
        connection.onerror = error => {
            terminal.innerHTML += "<p>Terminal Error, please restart application</p>"
        }

        terminali = document.getElementById("terminalI")

        terminali.focus();
        terminali.select();

        terminal.onclick = function(e) {
            terminali.focus();
            terminali.select();
        }

        document.getElementById('terminalI').onkeypress = function(e){
            if (!e) e = window.event;
            var keyCode = e.keyCode || e.which;
            if (keyCode == '13'){
				// Enter pressed
				if(terminali.value == "/clear") {
                    terminal.innerHTML= "";
                } else {
                    connection.send(terminali.value);	
				}
				terminali.value = "";
                return false;
            }
        }
    </script>
</html>	`;
}


exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
