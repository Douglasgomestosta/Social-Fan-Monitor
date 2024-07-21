/*!
* Social Fan Monitor
* Made by Social Fan Team
* https://github.com/Douglasgomestosta/Social-Fan-Monitor
* @license MIT
*/
const prompt = require('prompt-sync')();
let fs = require('fs');
const sqlite3 = require('sqlite3');
db = new sqlite3.Database(`database`);
db.run('CREATE TABLE IF NOT EXISTS `logs` (`name_service` TEXT NOT NULL,`date` INTEGER NOT NULL , `text` TEXT NOT NULL, `status` INTEGER NOT NULL );');
db.run('CREATE TABLE IF NOT EXISTS `downtime` (`name_service` TEXT NOT NULL,`date_start` INTEGER NOT NULL , `date_end` INTEGER NULL);');
db.run('CREATE TABLE IF NOT EXISTS `alerts` (`title` TEXT NOT NULL,`text` TEXT NOT NULL,`date` INTEGER NOT NULL , `color` INTEGER NULL);');
process.stdout.write('\x1Bc'); 
process.stdout.write(` #####    #####    #####    ######   #####   ###               #######   #####   ##  ###  
###  ##  ### ###  ### ###     ##    ### ###  ###               ###  ##  ### ###  ### ###  
###      ### ###  ###         ##    ### ###  ###               ###      ### ###  #######  
 #####   ### ###  ###         ##    #######  ###               #####    #######  #######  
     ##  ### ###  ###         ##    ### ###  ###               ###      ### ###  ### ###  
###  ##  ### ###  ### ###     ##    ### ###  ###  ##           ###      ### ###  ### ###  
 #####    #####    #####    ######  ### ###  #######           ###      ### ###  ### ###                                                                    
`); 

run();
async function run(){
console.log("Select the option you want to use:");
console.log("--------------------------------------");
console.log("1 - Website Alerts");
console.log("--------------------------------------");
var option = prompt('Select an option: ');
switch(option)
{
case "1":
option_1();
break;
}

}

async function option_1(){
console.log("what you want to do?");
console.log("--------------------------------------");
console.log("1 - add alert");
console.log("2 - view all alert");
console.log("3 - delete alert");
console.log("q - quit");
console.log("--------------------------------------");
var option = prompt('Select an option: ');
switch(option)
{
case "1":
var title = prompt('Insert a title:');
var text = prompt('Insert a text:');
console.log("0 - gray");
console.log("1 - green");
console.log("2 - yellow");
console.log("3 - red");
var color = prompt('Insert a color code:');
var stmt = db.prepare("INSERT INTO `alerts` (`title`,`text`,`date`,`color`) VALUES (?,?,'" + new Date().getTime() + "', ?)");
stmt.run(title,text,color);
stmt.finalize();
option_1();
break;
case "2":
db.all("SELECT rowid AS id,title,text,date,color from `alerts`;", [], (err, rows) => {
if (err) {
throw err;
}
rows.forEach((row) => {
console.log(row);
});
if(rows.length == 0){console.log("!!!The database don't have any alert saved!!!");}
option_1();
});

break;
case "3":
var option = prompt('Select the id to be deleted: ');
db.run('DELETE FROM alerts WHERE `rowid` = ' + option);
option_1();
break;
case "q":
run();
break;
}

}