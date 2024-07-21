/*!
* Social Fan Monitor
* Made by Social Fan Team
* https://github.com/Douglasgomestosta/Social-Fan-Monitor
* @license MIT
*/
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

var fetch = require('node-fetch');
const child_process = require("child_process");
let fs = require('fs');
const sqlite3 = require('sqlite3');
db = new sqlite3.Database(`database`);
db.run('CREATE TABLE IF NOT EXISTS `logs` (`name_service` TEXT NOT NULL,`date` INTEGER NOT NULL , `text` TEXT NOT NULL, `status` INTEGER NOT NULL );');
db.run('CREATE TABLE IF NOT EXISTS `downtime` (`name_service` TEXT NOT NULL,`date_start` INTEGER NOT NULL , `date_end` INTEGER NULL);');
db.run('CREATE TABLE IF NOT EXISTS `alerts` (`title` TEXT NOT NULL,`text` TEXT NOT NULL,`date` INTEGER NOT NULL , `color` INTEGER NULL);');
const app = require('fastify')({logger: false});
const os = require("os"); 
var file = fs.readFileSync('./config.json');
var config = JSON.parse(file);


app.post('/api/get_data', async function (req, reply) {
reply.send(await get_data_api());
})

app.post('/api/get_log_data', async function (req, reply) {
reply.send(await get_log_data(req.body));
})

app.post('/api/get_alerts', async function (req, reply) {
reply.send(await get_alerts());
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
if(item.last_checked !== undefined)
{
var actual_time = new Date().getTime();
var diference = (actual_time - item.last_checked) / 1000;
if(diference < (item.intervals - 5)){continue;}
}

try{
for await (const item_urls of item.urls){
var array_position_url = item.urls.findIndex(function(data){return data.name == item_urls.name;});
if(typeof item_urls.request_options.body == "object"){item_urls.request_options.body = JSON.stringify(item_urls.request_options.body);}//converts object body to json
var results = await send_request(item_urls.url,item_urls.request_options);
if(results.status !== 200 || results.text.includes(item_urls.return) == false){
console.log(`\x1b[33mfailed request at "${item_urls.name}", waiting 10 seconds and try again....`);
await sleep(10000);
var results = await send_request(item_urls.url,item_urls.request_options);
}
console.log(results);
if(results.status == 200 && results.text.includes(item_urls.return))
{//successful request
console.log(`\x1b[32msuccessful request at url ${item_urls.url}`);
if(item_urls.status == 0)
{
save_log(item.service_name,`url status "${item_urls.name}" changed from offline to online`,results.status);
}
config.services[array_position].urls[array_position_url].status = 1;
config.services[array_position].urls[array_position_url].status_info = {status:results.status,body:results.text,request_time:results.time}
}else{
console.log(`\x1b[31mfailed request at url ${item_urls.url}`);
if(item_urls.status !== 0)
{
save_log(item.service_name,`url status "${item_urls.name}" changed from online to offline`,results.status);
}
config.services[array_position].urls[array_position_url].status = 0;
config.services[array_position].urls[array_position_url].status_info = {status:results.status,body:results.text,request_time:results.time}
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
open_downtime(item.service_name);
}else{
close_downtime(item.service_name);
}

config.services[array_position].last_checked = new Date().getTime();
};


running_test = false;//the function has ben finished...

}



async function send_request(url,send){
let time1 = performance.now();
try{
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30000)
send.signal = controller.signal;
var result = await fetch(url, send)
let time2 = performance.now();
var result_body = await result.text();
return {status:result.status,text:result_body,time:(time2 - time1)};
}catch(err){
let time2 = performance.now();
return {status:0,text:err.message,time:(time2 - time1)};
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
child_process.exec(`XDG_RUNTIME_DIR=/run/user/$(id -u) notify-send -u critical "Social Fan monitor" "${message}"`, (err, stdout, stderr) => {console.log(stderr);});
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
var data_insert = {services:[],name:item.service_name,last_checked:item.last_checked}
for await (const item_urls of item.urls){
data_insert.services.push({name:item_urls.name,status:item_urls.status,status_info:item_urls.status_info})
}
data_insert.uptime = {}
if(config.uptime.day){data_insert.uptime.day = await get_downtime(item.service_name,86400000);}
if(config.uptime.week){data_insert.uptime.week = await get_downtime(item.service_name,604800000);}
if(config.uptime.month){data_insert.uptime.month = await get_downtime(item.service_name,2628002880);}
if(config.uptime.year){data_insert.uptime.year = await get_downtime(item.service_name,31536034560);}
data.push(data_insert);
}
return data;
}

async function get_alerts(){
return new Promise((resolve, reject) => {
db.all("SELECT rowid AS id,title,text,date,color from `alerts`;", [], (err, rows) => {
if (err) {
throw err;
}
resolve(rows);    
});

});
}


async function save_log(service_name,text,status){
try{
var stmt = db.prepare("INSERT INTO `logs` (`name_service`,`date`,`text`,`status`) VALUES (?,'" + new Date().getTime() + "', ?,?)");
stmt.run(service_name,text,status);
stmt.finalize();
}catch(err){console.log(err);}
}

async function get_log_data(json){
try{
if(json.name == undefined){return [];}
return new Promise((resolve, reject) => {
db.all('select date,text,status from `logs` where `name_service` = ? ORDER BY `rowid` DESC limit 30',[json.name],(err, row)=>{
resolve(row);
})
});
}catch(err){console.log(err);return '';}
}



async function open_downtime(name_service){
try{
db.get("SELECT count(*) count FROM downtime where `name_service` = ? AND `date_end` is null;",[name_service], (err, row) => {
if(row.count == 0)
{//If there is no open downtime marker, it creates a new one
var stmt = db.prepare("INSERT INTO `downtime` (`name_service`,`date_start`,`date_end`) VALUES (?,'" + new Date().getTime() + "', null)");
stmt.run(name_service);
stmt.finalize();
}
});
}catch(err){console.log(err);}
}

async function close_downtime(name_service){
try{
db.get("SELECT count(*) count FROM downtime where `name_service` = ? AND `date_end` is null;",[name_service], (err, row) => {
if(row.count > 0)
{//the service is online again, close the downtime marker :)
var stmt = db.prepare("update `downtime` set `date_end` = '" + new Date().getTime() + "' where `name_service` = ? AND `date_end` is null;");
stmt.run(name_service);
stmt.finalize();
}
});
}catch(err){console.log(err);}

}

async function get_downtime(name_service,time)
{
return new Promise((resolve, reject) => {
var date = new Date().getTime() - time;
db.all('select date_start,date_end from `downtime` where `name_service` = ? AND `date_start` > ' + date + ' OR `name_service` = ? AND `date_end` > '+ date + ' OR `name_service` = ? AND `date_end` is null ORDER BY `rowid` DESC',[name_service,name_service,name_service], async function(err, row){
var downtime = 0;
for await(var item of row){
if(item.date_end == null){item.date_end = new Date().getTime();}//If the marker does not yet have an end date, set the end date to the current time
if(item.date_start < date){item.date_start = date;}//If the marker start time exceeds the uptime time limit, it sets the time limit as the start time
downtime += (item.date_end - item.date_start);
}
resolve(downtime);
});
});
}


//garbage collector
setInterval(function(){delete_old_logs(); delete_old_uptime_data();}, 86400000);//run the garbage collector every 24 hours
setTimeout(function(){delete_old_logs(); delete_broken_downtime();delete_old_uptime_data();}, 20000);//run the garbage collector 20 seconds after start
async function delete_old_logs(){
try{
db.get("SELECT count(*) count FROM logs;", (err, row) => {
var remove = row.count - 1000;
if(remove > 0)
{
db.each("SELECT rowid AS id from `logs` ORDER BY `id` ASC limit " + remove + ";", (err, row) => {
db.run('DELETE FROM logs WHERE `rowid` = ' + row.id);
});
}
});
}catch(err){console.log(err);}
}
async function delete_broken_downtime(){
//This script deletes downtime markers that have no end date due to program disruption
db.run('DELETE FROM downtime WHERE `date_end` is null;');
}
async function delete_old_uptime_data(){
if(config.uptime.year)
{
var delete_date = (new Date().getTime() - 31536034560);
}else if(config.uptime.month){
var delete_date = (new Date().getTime() - 2628002880);
}else if(config.uptime.week){
var delete_date = (new Date().getTime() - 604800000);
}else if(config.uptime.day){
var delete_date = (new Date().getTime() - 86400000);
}else{
return;
}
db.run('DELETE FROM downtime WHERE `date_end` < ' + delete_date);
}
//end garbage collector