/*!
* Social Fan Monitor
* Made by Social Fan Team
* https://github.com/Douglasgomestosta/Social-Fan-Monitor
* @license MIT
*/

//This script works well on Linux with gnome interface
const child_process = require("child_process");
const http = require('http');
let fs = require('fs');
var file = fs.readFileSync('./config.json');
var config = JSON.parse(file);
process.stdout.write('\x1Bc'); 
process.stdout.write(` #####    #####    #####    ######   #####   ###               #######   #####   ##  ###  
###  ##  ### ###  ### ###     ##    ### ###  ###               ###  ##  ### ###  ### ###  
###      ### ###  ###         ##    ### ###  ###               ###      ### ###  #######  
 #####   ### ###  ###         ##    #######  ###               #####    #######  #######  
     ##  ### ###  ###         ##    ### ###  ###               ###      ### ###  ### ###  
###  ##  ### ###  ### ###     ##    ### ###  ###  ##           ###      ### ###  ### ###  
 #####    #####    #####    ######  ### ###  #######           ###      ### ###  ### ###  
                starting service notification program...                                                                     
`); 

const requestListener = async function(req, res) {
//console.log(req);
if(req.method == "POST")
{
let data = '';
req.on('data', chunk => {
data += chunk;
})
req.on('end', () => {
var dados = JSON.parse(data)
if(dados.key == config.key)
{
console.log("sending notification command...");
send_notification("Social Fan Monitor",dados.text);
}else{console.log("invalid key");}

})

res.writeHead(200);
res.end("");
return false;
}else{
res.writeHead(502);res.end("");return false;    
}
};

const server = http.createServer(requestListener);


start();

async function start(){
var processos = await processos_nodejs();
var quantia_processos = (processos.match(/monitor_notification/g) || []).length;
if(quantia_processos > 1){console.log(processos.match(/monitor_notification/g));process.exit(1);}else{
server.listen(9596, () => {
console.log(`Server is running`);
});

};

}



async function processos_nodejs(){
return new Promise((resolve, reject) => {
child_process.exec(`ps -fC node`, (err, stdout, stderr) => {
//console.log(err);
//console.log(stderr);
console.log(stdout);
resolve(stdout);
// the *entire* stdout and stderr (buffered)
});
});
}

async function send_notification(title,text){
if(await is_muted())
{
child_process.exec(`XDG_RUNTIME_DIR=/run/user/$(id -u) notify-send -u critical "${title}" "${text}"`, (err, stdout, stderr) => {console.log(stderr);});
}else{
console.log("the notification system is muted!");
}
}


async function is_muted(){
return new Promise((resolve, reject) => {//view if notifications is muted
child_process.exec(`gsettings get org.gnome.desktop.notifications show-banners`, (err, stdout, stderr) => {
if(stdout.includes("true"))
{
resolve(true);
}else{
resolve(false);
}
});

});
}