var fetch = require('node-fetch');
const child_process = require("child_process");
let fs = require('fs');
const app = require('fastify')({logger: false});
const os = require("os"); 
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
                       starting service monitoring program...                                                                     
`); 


app.post('/api/get_data', async function (req, reply) {
reply.send(await get_data_api());
})

app.get('/alldone', function (req, reply) {reply.send('yes')});

app.get('/*', function (req, reply) {
const stream = fs.createReadStream('index.html', 'utf8')
reply.header('Content-Type', 'text/html')
reply.send(stream)
})


start_server()
async function start_server(){
try{
app.listen({ port: config.http_port,host:"::" })
}catch (err) {
console.log(err);
process.exit(1)
}
}


var running_test = false;
setInterval(run_tests,60000);//run the code every 60 seconds to verify services status
async function run_tests(){
if(running_test == true){
console.log("\x1b[33mthe last run_tests() has not finished yet...");
return false;
}
console.log("\x1b[32mstarting the analysis of services...");
running_test = true;
for await (const item of config.services){
var array_position = config.services.findIndex(function(data){return data.service_name == item.service_name;});
try{
for await (const item_urls of item.urls){
var array_position_url = item.urls.findIndex(function(data){return data.name == item_urls.name;});
var actual_time = new Date().getTime();
if(item_urls.last_check !== undefined)
{
var diference = (actual_time - item_urls.last_check) / 1000;
if(diference < item.intervals){continue;}
}
item_urls.last_check = actual_time;
if(typeof item_urls.request_options.body == "object"){item_urls.request_options.body = JSON.stringify(item_urls.request_options.body);}//converts object body to json
var results = await send_request(item_urls.url,item_urls.request_options);
if(results.status !== 200 || results.text !== item_urls.return){
console.log(`\x1b[33mfailed request at "${item_urls.name}", waiting 30 seconds and try again....`);
await sleep(30000);//30000
var results = await send_request(item_urls.url,item_urls.request_options);
}
console.log(results);
if(results.status == 200 || results.text == item_urls.return)
{//successful request
console.log(`\x1b[32msuccessful request at url ${item_urls.url}`);
config.services[array_position].urls[array_position_url].status = 1;
}else{
console.log(`\x1b[31mfailed request at url ${item_urls.url}`);
config.services[array_position].urls[array_position_url].status = 0;
if(item_urls.notification)
{//send notification about this issue
send_notifications(`service url '${item_urls.name}' unsuccessful request with status ${results.status}`);
}

if(item_urls.alarm)
{//alarm sound
alarm_sound();
}



}
}




}catch(err){console.log(err);}


var online_url = config.services[array_position].urls.findIndex(function(data){return data.status == 1;});
if(online_url == -1)
{//all service group urls are down, service completely degraded
if(item.notification){
send_notifications(`service group '${item.service_name}' completely degraded`);
}
if(item.alarm){
alarm_sound();
}

}


};


running_test = false;//the function has ben finished...

}



async function send_request(url,send){
try{
var result = await fetch(url, send)
var result_body = await result.text();
return {status:result.status,text:result_body};
}catch(err){
return {status:0,text:''};
}
}

function sleep (time) {
return new Promise((resolve) => setTimeout(resolve, time));
}


async function send_notifications(message){
let osVersion = os.platform(); 
switch(osVersion)
{
case "linux":
child_process.exec(`notify-send -u critical "Social Fan monitor" "${message}"`, (err, stdout, stderr) => {console.log(stderr);});
break;
case "android":
child_process.exec(`termux-notification -t "Social Fan Monitor" -c "${message}"`, (err, stdout, stderr) => {console.log(stderr);});
break;
}

if(config.remote_notification !== null && config.remote_notification !== undefined)
{//send remote notifications
try{
await fetch(config.remote_notification.url,{method: 'POST',body: JSON.stringify({"key":config.remote_notification.key,"text":message})})
}catch(err){console.log(err);}
}

}

var alert_running = false
async function alarm_sound(){
if(alert_running == true){return;}
alert_running = true;
let osVersion = os.platform(); 
switch(osVersion)
{
case "linux":
console.log(`\x1b[33m!You need to install sox to use alarm sounds on Linux!`);
await linux_sound();
break;
case "android":
flash_alert();
await android_sound();
break;
default:
console.log(`\x1b[31mdevice OS does not support audio alerts`);
}
alert_running = false;
}

async function flash_alert(){
child_process.exec(`termux-torch on`, (err, stdout, stderr) => {console.log(stderr);
setTimeout(function(){ 
child_process.exec(`termux-torch off`, (err, stdout, stderr) => {console.log(stderr);
});
}, 20000);
});
}

async function android_sound(){
return new Promise((resolve, reject) => {
child_process.exec(`termux-media-player stop`, (err, stdout, stderr) => {
child_process.exec(`termux-volume music 13`, (err, stdout, stderr) => {
child_process.exec(`termux-media-player play alarm.mp3`, (err, stdout, stderr) => {
resolve(true);
});
});
});    
});
}
async function linux_sound(){
return new Promise((resolve, reject) => {
child_process.exec(`play alarm.mp3`, (err, stdout, stderr) => {
return true;
});
});
}


async function get_data_api(){
var data = [];
for await (const item of config.services){
var data_insert = {services:[],name:item.service_name}
for await (const item_urls of item.urls){
data_insert.services.push({name:item_urls.name,status:item_urls.status})
}

data.push(data_insert);
}
return data;
}