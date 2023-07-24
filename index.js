import { configDotenv } from 'dotenv';
import Imap from 'imap'
import mongoose, { Schema } from 'mongoose';
import fs from 'fs'
import { simpleParser } from 'mailparser'
import puppeteer from 'puppeteer';
configDotenv()

const imap = new Imap({
    user: process.env.IMAP_USERNAME,
    password: process.env.IMAP_PASSWORD,
    host: process.env.IMAP_SERVER,
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
});

const MONGODB_URL = process.env.MONGODB_URL;
const COLLECTION_NAME = 'Templates';

mongoose.connect(MONGODB_URL);
const Templates = mongoose.model('Templates', new Schema({
    subject: String,
    sender: String,
    body: String,
    html: String,
    messageId: String
}, {
    collection: COLLECTION_NAME
}, {
    timestamps: true
}));

const emails = [];

function openInbox(cb) {
    imap.openBox('INBOX', true, cb);
}

async function main() {
    try {
        const time = fs.readFileSync('time.txt')
        console.log(time.toString());
        
        imap.once('ready', function () {
            openInbox(async function (err, box) {
                if (err) throw err;
                const start = new Date(time.toString());
                const searchCriteria = ['ALL', ['SINCE', start.toISOString()]];
                console.log({ searchCriteria });

                const results = await new Promise((resolve, reject) => {
                    imap.search(searchCriteria, function (err, results) {
                        if (err) reject(err);
                        resolve(results);
                    });
                });
                const fetch = imap.fetch(results, { bodies: '', struct: true });

                fetch.on('message', function (msg, seqno) {
                    msg.on('body', function (stream, info) {
                        simpleParser(stream, async function (err, parsedEmail) {
                            if (err) throw err;

                            const subject = parsedEmail.subject;
                            const sender = parsedEmail.from.text;
                            const body = parsedEmail.text;
                            const html = parsedEmail.html;
                            const messageId = parsedEmail.messageId;

                            const browser = await puppeteer.launch();
                            const page = await browser.newPage();
                            await page.setContent(html)
                            const imageBuffer = await page.screenshot({ encoding: 'binary' });
                            fs.writeFileSync(`${messageId.replace( new RegExp("[^a-zA-Z0-9]","gm"),"+")}.png`, imageBuffer, 'binary');
                            await browser.close();

                            // To-do
                            // 1. Upload Image on cloud storage and get path 

                            emails.push({
                                subject,
                                sender,
                                body,
                                html,
                                messageId,
                            });

                        });
                    });
                    fs.writeFileSync('time.txt', new Date().toString());
                });

                fetch.once('end', async function () {
                    imap.end();
                    // await Templates.insertMany(emails);
                });
            });
        });

        imap.once('error', function (err) {
            console.log(err);
        });

        imap.once('end', function () {
            console.log('Email fetching completed.');
        });

        imap.connect();

    } catch (error) {
        throw error;
    }
}

main().catch(console.error);


// try {
//     imap.once('ready', function () {
//         openInbox(async function (err, box) {
//             if (err) throw err;

//             const today = new Date();
//             today.setHours(0, 0, 0, 0);

//             const searchCriteria = ['ALL', ['SINCE', today.toISOString()]];
//             console.log({ searchCriteria });

//             // const results = await new Promise((resolve, reject) => {
//             //     imap.search(searchCriteria, function (err, results) {
//             //         if (err) reject(err);
//             //         resolve(results);
//             //     });
//             // });

//             // const fetch = imap.fetch(results, { bodies: '', struct: true });

//             // fetch.on('message', function (msg, seqno) {
//             //     msg.on('body', function (stream, info) {
//             //         simpleParser(stream, async function (err, parsedEmail) {
//             //             if (err) throw err;

//             //             const subject = parsedEmail.subject;
//             //             const sender = parsedEmail.from.text;
//             //             const body = parsedEmail.text;
//             //             const html = parsedEmail.html;
//             //             const messageId = parsedEmail.messageId;

//             //             emails.push({
//             //                 subject,
//             //                 sender,
//             //                 body,
//             //                 html,
//             //                 messageId,
//             //             });

//             //         });
//             //     });
//             // });

//             // fetch.once('end', function () {
//             //     imap.end();
//             // });
//         });
//     });

//     imap.once('error', function (err) {
//         console.log(err);
//     });

//     imap.once('end', function () {
//         console.log('Email fetching completed.');
//     });

//     imap.connect();
// } catch (error) {

// }