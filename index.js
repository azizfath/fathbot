const wa = require('@open-wa/wa-automate')
const got = require('got')
const QRreader = require('qrcode-reader')
const Jimp = require('jimp')
const { getSync } = require('@andreekeberg/imagedata')
const jsQR = require('jsqr')
const Cheerio = require('cheerio')
const FormData = require('form-data')

const jadwal = require('./jadwal.json')
const endpoint = require('./endpoint.json')
const isNim = new RegExp(/\d{2}.\d{2}.\d{4}/)
const qr_failed = 'QR tidak dapat dibaca'

const ua = '@m!k0mXv=#neMob!le'

wa.create({
        sessionId: 'FathBot',
        disableSpins: true,
        multiDevice: true,
        qrTimeout: 0,
        authTimeout: 0,
        cacheEnabled: false
    })
    .then(client => start(client))
    .catch((error) => console.log(error))

async function start(client) {
    client.onMessage(async message => {
        const { type, id, from, t, sender, chat, caption, isMedia, mimetype, quotedMsg, body } = message
        const data = caption || body
        var m = data.split(' ')
        m[0] = m[0].toLowerCase()

        switch (m[0]) {
            case '.s':
            case '.st':
            case '.status':
            case '.':
                client.reply(from, 'Server Alive', id)
                break
            case '.p':
            case '.a':
            case '.presensi':
            case '.absen':
                var nim, qr_text
                for (i = 1; i < m.length; i++) {
                    if (m[i] == '-nim' || m[i] == '-n') {
                        tmp = m[i + 1]
                        if (isNim.test(tmp) && m[i].length <= 10) {
                            nim = tmp
                        }
                    }
                    if (isNim.test(m[i]) && m[i].length <= 10) {
                        nim = m[i]
                    }
                    if ((m[i] == '-v' || m[i] == '-qr' || m[i] == '-data') && !isNim.test(m[i])) {
                        qr_text = m[i + 1]
                    }
                    if (m[i].length > 10 && !isNim.test(m[i])) {
                        qr_text = m[i]
                    }
                }

                var img
                if (isMedia && type === 'image') {
                    img = await wa.decryptMedia(message)
                } else if (quotedMsg && quotedMsg.type === 'image') {
                    img = await wa.decryptMedia(quotedMsg)
                }

                if (img != null) {
                    qr_text = await decode_qr(img)
                    if (qr_text == qr_failed) {
                        await client.reply(from, qr_failed, id)
                        return
                    }
                }
                if (nim == null) {
                    await client.reply(from, 'Masukan NIM terlebih dahulu', id)
                    return
                }
                if (qr_text == null) {
                    await client.reply(from, 'Tidak ada data QR', id)
                    return
                }

                if (nim != null && qr_text != null && qr_text != qr_failed) {
                    result = await presensi_qr(qr_text, nim)
                    client.reply(from, result, id)
                }
                break

            case '.qr':
            case '.qrcode':
            case '.decode':
                var img
                if (isMedia && type === 'image') {
                    img = await wa.decryptMedia(message)
                } else if (quotedMsg && quotedMsg.type === 'image') {
                    img = await wa.decryptMedia(quotedMsg)
                }

                qr_text = await decode_qr(img)
                await client.reply(from, qr_text, id)
                break

            case '.link':
            case '.jadwal':
                await client.reply(from, '==== SENIN ====' +
                    '\n08.40 RisetOp [05.03.06]\n' + jadwal.RISETOP +
                    '\n\n09.50 BigData T [05.03.06]\n' + jadwal.BIGDATAT1 +
                    '\n\n11.00 ANSI [05.03.06]\n' + jadwal.ANSI1 +
                    '\n\n\n==== SELASA ====' +
                    '\n08.40 PBD(3) T [05.04.02]\n' + jadwal.PBD3T +
                    '\n\n09.50 AI [04.02.01]\n' + jadwal.AI +
                    '\n\n11.00 Kecakap [04.03.03]\n' + jadwal.KECAKAP +
                    '\n\n13.00 ANSI [04.03.03]\n' + jadwal.ANSI2 +
                    '\n\n14.10 P.WEB T [04.03.03]\n' + jadwal.PWEBT +
                    '\n\n\n==== RABU ====' +
                    '\n08.40 Aljabar [05.03.01]\n' + jadwal.ALJABAR +
                    '\n\n09.50 P.WEB P [L 2.4.3]\n' + jadwal.PWEBP +
                    '\n\n11.00 BigData T [05.03.08]\n' + jadwal.BIGDATAT2 +
                    '\n\n11.00 BigData P [L 7.3.2]\n' + jadwal.BIGDATAP +
                    '\n\n\n==== KAMIS ====' +
                    '\n07.30 PBD(3) P [L 2.4.2]\n' + jadwal.PBD3P, id)
                break
            default:
                break
        }
    })
}

async function scanQRcode(path) {
    var img = await Jimp.read(path)
    qrcode = new QRreader()
    qrcode.callback = function(err, value) {
        if (err) {
            data = qr_failed
            return
        }
        data = value.result
    }

    qrcode.decode(img.bitmap)
    return data
}

async function scanJSQR(path) {
    const imageData = getSync(path)
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (!code) return qr_failed
    return code.data
}

async function scanImgonline(path) {
    const form = new FormData()
    form.append('uploadfile', path, 'qrcode')
    form.append('codetype', 2)
    form.append('rotset', 0)
    form.append('croptype', 1)

    const response = await got
        .post('https://www.imgonline.com.ua/eng/scan-qr-bar-code-result.php', {
            headers: form.getHeaders(),
            body: form

        }).text()

    const $ = Cheerio.load(response)
    result = $('#content div').text().trim()
    if (result === '') result = qr_failed
    return result
}

async function decode_qr(path) {
    result = await scanQRcode(path)
    if (result === qr_failed)
        result = await scanJSQR(path)
    if (result === qr_failed)
        result = await scanImgonline(path)

    return result
}

async function presensi_qr(data, nim) {
    try {
        await got.post(endpoint.link_qr, {
            headers: {
                'user-agent': ua,
            },
            json: {
                data: `${data};${nim}`
            }
        }).json()
        return nim + ': Berhasil Presensi'

    } catch (error) {
        console.log(error.response);
        if (error.response.statusCode == 400) {
            return 'Response : 400 Bad Request'
        }
        if (error.response.statusCode == 422) {
            return nim + ': Sudah Presensi'
        }
    }
}