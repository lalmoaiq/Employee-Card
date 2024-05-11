const express = require('express');
const bodyParser = require('body-parser');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const app = express();
const qrcode = require('qrcode');
const CryptoJS = require("crypto-js");
const axios = require('axios');


// Use body-parser middleware to parse JSON body
app.use(bodyParser.json({
    limit: '5mb'
}));

// Register the Arabic font
registerFont('assets/DINNextLTArabic-Bold.ttf', { family: 'Bold' });
registerFont('assets/DINNextLTArabic-Regular.ttf', { family: 'Regular' });
registerFont('assets/canterbury.regular.ttf', { family: 'Canterbury' });
console.timeEnd('loadfonts');
console.time('loadImage');
console.timeEnd('loadImage');

//function that generates the back of the empoyee card with the expiration date
async function BackCardPDF(BackgroundImageBack, dateColor) {
  try{
    let imageSource2= await loadImage(BackgroundImageBack);
    // Load the image
    const image2 = imageSource2;
  
    // Create a canvas with the same dimensions as the image
    const canvas = createCanvas(image2.width, image2.height);
    const ctx = canvas.getContext('2d');

    // Draw the image onto the canvas
    ctx.drawImage(image2, 0, 0, image2.width, image2.height);
    ctx.textAlign = "center";
    ctx.fillStyle= dateColor;
    ctx.font = '80px Regular'; // for Arabic text
    
    const currentDate = new Date();
    currentDate.setFullYear(currentDate.getFullYear() + 1); // adds one year to date 
    const newDate = currentDate.toLocaleDateString(); // converts currentDate to string
    ctx.fillText(newDate, 649, 455);

    const imgBuffer2 = canvas.toBuffer('image/png');
    const base64String2 = Buffer.from(imgBuffer2).toString('base64');
    console.timeEnd('base64String');
    return base64String2;
  }
  catch(error){
    console.log(error);
  }
};

function Encrypt(word, key ) {

  let encJson = CryptoJS.AES.encrypt(JSON.stringify(word), key).toString();
  let encData = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(encJson));
  return encData;
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let yPos = y;
  
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && i > 0) {
        context.fillText(line, x, yPos);
        line = words[i] + ' ';
        yPos += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, yPos);
  }

//defining variables that would change depending on employee type
let BackgroundImageFront = 'FrontCardNonConsultant.png';
let BackgroundImageBack = 'BackCardNonConsultant.png';
let dateColor = '#00AE87';
let positionColor = '#4CC0E7'; 

app.post('/generateCard', async (req, res) => {

  try{
    const {empid} = req.body;
   
    if (!empid) {
        return res.status(400).send('Missing data in request body');
    }
    
    //calls API with bearer token
    const optionspages = {
      method: 'GET',
      url: 'COMPANY LINK'+empid, //removed for privacy (url)
      headers: {
        Authorization: 'BEARER TOKEN' //removed for privacy (bearer token)
      }
    }

    let response = await axios(optionspages);

    if(response.data)
    { 

        if (response.data.EmployeeCardInfo.EMPLOYEE_TYPE ==  'Consultant') // Image and certain colours must be changed
        {
            BackgroundImageFront = 'FrontCardConsultant.png'; 
            BackgroundImageBack = 'BackCardConsultant.png'; 
            dateColor = '#0C436A';
            positionColor = '#0C436A';

        }
        
    let imageSource= await loadImage(BackgroundImageFront);
    // Load the image
    const image = imageSource;
    // Create a canvas with the same dimensions as the image
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw the image onto the canvas
    ctx.drawImage(image, 0, 0, image.width, image.height);
    ctx.textAlign = "center";
 
    const base64Image = response.data.EmployeeCardInfo.IMAGE;
    const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const binaryString = Buffer.from(base64Data, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
     bytes[i] = binaryString.charCodeAt(i);
    }
 
    const profileBytes = bytes.buffer;

    const profile = await loadImage(Buffer.from(profileBytes)); 
    ctx.drawImage(profile, 310, 435, 673, 760); 

    ctx.font = '100px Bold'; // for Arabic text
    ctx.fillStyle= '#FFFFFF';
    wrapText(ctx, response.data.EmployeeCardInfo.FULL_NAME_AR, canvas.width / 2,  1320, 1100, 105);

    ctx.font = '80px Regular'; // for Arabic text
    ctx.fillStyle= positionColor; // color varies depending on employee type
    ctx.fillText(response.data.EmployeeCardInfo.POSITION_AR, canvas.width / 2, 1495); //1440 original
    
    ctx.font = '60px Regular'; // for Arabic text
    ctx.fillStyle= '#FFFFFF'; //white hex
    wrapText(ctx, response.data.EmployeeCardInfo.DEPARTMENT_AR, 380,  1666, 600, 60); 
    

    ctx.font = '60px Regular'; // for English text
    ctx.fillText(response.data.EmployeeCardInfo.EMPLOYEE_NUMBER, 430, 1880);  

    
    empIdQRCode = Encrypt(empid, 'PRIVATE').toString(); // removed for privacy

    const qrOption = {
      margin : 5,
      width : 175,
      color:{dark : "#00416Bff", light : "#ffffffff"}
    };

//QR CODE
    const qrString = 'COMPANY LINK'+empIdQRCode; //removed for privacy (company link)
    const b64 =  await qrcode.toDataURL(qrString,qrOption);
    const QRCodeBytes = await fetch(b64).then((res) => res.arrayBuffer());
    const QRCode = await loadImage(Buffer.from(QRCodeBytes));
    ctx.drawImage(QRCode, 750, 1590, 345, 345); 


    // Convert the canvas to a buffer in PNG format
    console.time('imgBuffer');
    const imgBuffer = canvas.toBuffer('image/png');

    const base64String1 = Buffer.from(imgBuffer).toString('base64');
    let base64String2=await BackCardPDF(BackgroundImageBack, dateColor);

    let response1={
      front:base64String1,
      back:base64String2
    }
    res.json(response1);
  }
  else{
    console.log("response data was not collected");
  }
  }
  catch(error){
    console.log(error);
    res.status(404).send('Not Found');
  }
});

//generates card without using api call to retrieve employee information 
app.post('/generateCardFull', async (req, res) => {

  try{
    const {EmployeeCard: {Name, Title, Department, EmployeeID, ImageBase64, EmployeeType}} = req.body; 

    if (!Name || !Title || !Department || !EmployeeID || !ImageBase64 || !EmployeeType) {
        return res.status(400).send('Missing data in request body');
    }

    if (EmployeeType == "Consultant") // Image and certain colours must be changed
    {
        BackgroundImageFront = 'FrontCardConsultant.png'; 
        BackgroundImageBack = 'BackCardConsultant.png'; 
        dateColor = '#0C436A';
        positionColor = '#0C436A';
    }

    let imageSource= await loadImage(BackgroundImageFront);
    // Load the image
    const image = imageSource;
    console.time('DrawCanvas');
    // Create a canvas with the same dimensions as the image
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    // Draw the image onto the canvas
    ctx.drawImage(image, 0, 0, image.width, image.height);
    ctx.textAlign = "center";

    const base64Data = ImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const binaryString = Buffer.from(base64Data, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    } 

    const profile = await loadImage(Buffer.from(bytes.buffer));
    ctx.drawImage(profile, 310, 435, 673, 760); 

    ctx.font = '100px Bold'; // for Arabic text
    ctx.fillStyle= '#FFFFFF';
    wrapText(ctx, Name, canvas.width / 2,  1320, 1100, 105);

    ctx.font = '80px Regular'; // for Arabic text
    ctx.fillStyle = positionColor;
    ctx.fillText(Title, canvas.width / 2, 1495);
    
    ctx.font = '60px Regular'; // for Arabic text
    ctx.fillStyle= '#FFFFFF'; //white hex
    wrapText(ctx, Department, 380,  1666, 600, 60); 

    ctx.font = '60px Regular'; // for English text
    ctx.fillText(EmployeeID, 430, 1880);

    // QR Code
    empIdQRCode = Encrypt(EmployeeID, 'PRIVATE').toString(); // removed for privacy

    const qrOption = {
      margin : 5,
      width : 175,
      color:{dark : "#00416Bff", light : "#ffffffff"}
    };

    const qrString = 'COMPANY LINK'+empIdQRCode; // removed for privacy (company link)
    const b64 =  await qrcode.toDataURL(qrString,qrOption);
    const QRCodeBytes = await fetch(b64).then((res) => res.arrayBuffer());
    const QRCode = await loadImage(Buffer.from(QRCodeBytes));
    ctx.drawImage(QRCode, 750, 1590, 345, 345);


    console.timeEnd('DrawCanvas');
    // Convert the canvas to a buffer in PNG format
    console.time('imgBuffer');
    const imgBuffer = canvas.toBuffer('image/png');

    const base64String1 = Buffer.from(imgBuffer).toString('base64');
    let base64String2=await BackCardPDF(BackgroundImageBack, dateColor);

    console.timeEnd('base64String');
    let response1={
      front:base64String1,
      back:base64String2
    }
    res.json(response1);
    
  }
  catch(error){
    console.log(error);
    res.status(404).send('Not Found');
  }
});


app.listen(3112, () => {
    console.log('Server listening on port 3112');
});
