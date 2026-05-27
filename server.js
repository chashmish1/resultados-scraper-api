const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Enable stealth plugin to bypass Cloudflare
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

// Simple authentication key so no one else can use your API (Optional but recommended)
const API_SECRET = process.env.API_SECRET || 'resultados-secret-key-123';

app.get('/scrape', async (req, res) => {
    const targetUrl = req.query.url;
    const key = req.query.key;

    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (key !== API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        // Randomize User Agent for extra stealth
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        
        // Wait until network is idle (to ensure Cloudflare JS runs)
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // If there is a Cloudflare challenge, wait a few seconds for it to pass
        const title = await page.title();
        if (title.includes('Just a moment') || title.includes('Cloudflare')) {
            console.log('Cloudflare detected. Waiting for redirect...');
            await page.waitForTimeout(5000); // wait 5 seconds for JS to solve challenge
        }

        const html = await page.content();
        await browser.close();

        res.send(html);
    } catch (error) {
        console.error('Scraping error:', error);
        if (browser) await browser.close();
        res.status(500).json({ error: 'Failed to scrape the website', details: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('ResultadosVenezuela Scraper API is running!');
});

app.listen(PORT, () => {
    console.log(`Scraper API listening on port ${PORT}`);
});
