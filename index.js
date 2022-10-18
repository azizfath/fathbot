const wa = require("@open-wa/wa-automate");
const got = require("got");
const QRreader = require("qrcode-reader");
const Jimp = require("jimp");
const { getSync } = require("@andreekeberg/imagedata");
const jsQR = require("jsqr");
const Cheerio = require("cheerio");
const FormData = require("form-data");

const jadwal = require("./jadwal.json");
const endpoint = require("./endpoint.json");
const isNim = new RegExp(/\d{2}.\d{2}.\d{4}/);
const qr_failed = "⛔ QR tidak dapat dibaca";

const ua = "@m!k0mXv=#neMob!le";

const JSONdb = require("simple-json-db");
const db = new JSONdb("./dbFathbot.json");

const workspace_id = "120363043232082192@g.us";
const { exec } = require("child_process");

wa.create({
        sessionId: "FathBot",
        disableSpins: true,
        multiDevice: true,
        qrTimeout: 0,
        authTimeout: 0,
        cacheEnabled: false,
    })
    .then((client) => start(client))
    .catch((error) => console.log(error));

async function start(client) {
    client.onMessage(async(message) => {
        const {
            type,
            id,
            from,
            t,
            sender,
            chat,
            caption,
            isMedia,
            mimetype,
            quotedMsg,
            body,
        } = message;
        const data = caption || body;
        let m = data.split(" ");
        m[0] = m[0].toLowerCase();

        if (from !== workspace_id) {
            if (data === "") {
                var img;
                if (isMedia && type === "image") {
                    try {
                        await db.has(from);
                    } catch (error) {}
                    img = await wa.decryptMedia(message);
                    var qr_text,
                        nim = db.get(from);
                    if (img != null) {
                        qr_text = await decode_qr(img);
                        if (qr_text == qr_failed) {
                            await client.reply(from, qr_failed, id);
                            return;
                        }
                    }
                    if (nim == null) {
                        await client.reply(from, "Masukan NIM terlebih dahulu", id);
                        return;
                    }
                    if (qr_text == null) {
                        await client.reply(from, "Tidak ada data QR", id);
                        return;
                    }
                    if (nim != null && qr_text != null && qr_text != qr_failed) {
                        result = await presensi_qr(qr_text, nim);
                        client.reply(from, result, id);
                    }
                }
            }

        }

        switch (m[0]) {
            case ".ram":
                exec(
                    `neofetch --stdout | grep -e "Memory"`,
                    (error, stdout, stderr) => {
                        if (error) {
                            // console.log(`error: ${error.message}`);
                            client.reply(from, `error: ${error.message}`, id);
                            return;
                        }
                        if (stderr) {
                            // console.log(`stderr: ${stderr}`);
                            client.reply(from, `stderr: ${stderr}`, id);
                            return;
                        }
                        // console.log(`stdout: ${stdout}`);
                        client.reply(from, `${stdout}`, id);
                    }
                );
                break;
            case ".setnim":
                if (isNim.test(m[1])) nim = m[1];
                try {
                    await db.set(`${from}`, nim);
                    client.reply(
                        from,
                        `Nim Anda ${nim} telah disimpan untuk nomor Anda`,
                        id
                    );
                } catch (error) {
                    console.log(error);
                }
                break;
            case ".ceknim":
                try {
                    if (await db.has(from)) {
                        var result = await db.get(from);
                        client.reply(from, `Nim Anda adalah: ${result}`, id);
                    } else {
                        client.reply(from, `Anda belum menyimpan NIM`, id);
                    }
                } catch (error) {
                    console.log(error);
                }
                break;
            case ".hapusnim":
                try {
                    if (await db.has(from)) {
                        var result = await db.get(from);
                        await db.delete(from);
                        client.reply(from, `Nim Anda ${result} telah dihapus`, id);
                    } else {
                        client.reply(from, `Anda belum menyimpan NIM`, id);
                    }
                } catch (error) {
                    console.log(error);
                }
                break;
            case ".":
                client.reply(from, "Server Alive", id);
                break;
            case ".p":
            case ".a":
            case ".presensi":
            case ".absen":
                var qr_text, nim;
                for (i = 1; i < m.length; i++) {
                    if (m[i] == "-nim" || m[i] == "-n") {
                        tmp = m[i + 1];
                        if (isNim.test(tmp) && m[i].length <= 10) {
                            nim = tmp;
                        }
                    }
                    if (isNim.test(m[i]) && m[i].length <= 10) {
                        nim = m[i];
                    }
                    if (
                        (m[i] == "-v" || m[i] == "-qr" || m[i] == "-data") &&
                        !isNim.test(m[i])
                    ) {
                        qr_text = m[i + 1];
                    }
                    if (m[i].length > 10 && !isNim.test(m[i])) {
                        qr_text = m[i];
                    }
                }

                if (isMedia && type === "image") {
                    img = await wa.decryptMedia(message);
                } else if (quotedMsg && quotedMsg.type === "image") {
                    img = await wa.decryptMedia(quotedMsg);
                }

                if (img != null) {
                    qr_text = await decode_qr(img);
                    if (qr_text == qr_failed) {
                        await client.reply(from, qr_failed, id);
                        return;
                    }
                }
                if (nim == null) {
                    await client.reply(from, "Masukan NIM terlebih dahulu", id);
                    return;
                }
                if (qr_text == null) {
                    await client.reply(from, "Tidak ada data QR", id);
                    return;
                }

                if (nim != null && qr_text != null && qr_text != qr_failed) {
                    result = await presensi_qr(qr_text, nim);
                    client.reply(from, result, id);
                }
                break;

            case ".qr":
                if (isMedia && type === "image") {
                    img = await wa.decryptMedia(message);
                } else if (quotedMsg && quotedMsg.type === "image") {
                    img = await wa.decryptMedia(quotedMsg);
                }

                qr_text = await decode_qr(img);
                await client.reply(from, qr_text, id);
                break;

            default:
                break;
        }
    });
}

async function scanQRcode(path) {
    let img = await Jimp.read(path);
    qrcode = new QRreader();
    qrcode.callback = function(err, value) {
        if (err) {
            data = qr_failed;
            return;
        }
        data = value.result;
    };

    qrcode.decode(img.bitmap);
    return data;
}

async function scanJSQR(path) {
    const imageData = getSync(path);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (!code) return qr_failed;
    return code.data;
}

async function scanImgonline(path) {
    const form = new FormData();
    form.append("uploadfile", path, "qrcode");
    form.append("codetype", 2);
    form.append("rotset", 0);
    form.append("croptype", 1);

    const response = await got
        .post("https://www.imgonline.com.ua/eng/scan-qr-bar-code-result.php", {
            headers: form.getHeaders(),
            body: form,
        })
        .text();

    const $ = Cheerio.load(response);
    result = $("#content div").text().trim();
    if (result === "") result = qr_failed;
    return result;
}

async function decode_qr(path) {
    result = await scanQRcode(path);
    if (result === qr_failed) result = await scanJSQR(path);
    if (result === qr_failed) result = await scanImgonline(path);

    return result;
}

async function presensi_qr(data, nim) {
    try {
        await got
            .post(endpoint.link_qr, {
                headers: {
                    "user-agent": ua,
                },
                json: {
                    data: `${data};${nim}`,
                    location: `Amikom`,
                },
            })
            .json();
        return nim + ": ✅ Berhasil Presensi";
    } catch (error) {
        // console.log(error.response);
        if (error.response.statusCode == 400) {
            return "⛔ QR Expired";
        }
        if (error.response.statusCode == 422) {
            return nim + ": ❌ Sudah Presensi";
        }
    }
}