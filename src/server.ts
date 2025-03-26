import * as express from 'express';
import { Request, Response } from 'express';
import { ScraperManager } from './manager';
import { logger } from './config';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use((req: Request, res: Response, next) => {
    logger.info(`Received ${req.method} request for ${req.url} with query params: ${JSON.stringify(req.query)}`);
    next();
});
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    res.status(200).send({ status: 'OK' });
});

app.get('/scrape', async (req: Request, res: Response) => {
    const { videosNum, sentinalUser, proxyRegion } = req.query as { videosNum: string; sentinalUser: string, proxyRegion: string };
    const scraperManager = new ScraperManager(Number(videosNum), sentinalUser, proxyRegion);

    try {
        await scraperManager.startScraping();
        const finalDest = scraperManager.getFinalBucketDestination();
        res.status(200).send({ message: 'Scraping started successfully', finalDest });
    } catch (error) {
        logger.error('Error starting scraping', error);
        res.status(500).send({ message: 'Failed to start scraping', error: (error as Error).message });
    }
});

app.listen(PORT, () => {
    logger.info(`>>> Server is up & listening on port ${PORT}`);
});