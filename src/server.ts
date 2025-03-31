import * as express from 'express';
import { Request, Response } from 'express';
import { ScraperManager } from './manager';
import { logger } from './config';
import { DataHandler } from './dataHandler';

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
    const { videosNum, sentinalUser, proxyRegion, concBrowsNum } = req.query as { videosNum: string; sentinalUser: string, proxyRegion: string, concBrowsNum: string };
    const scraperManager = new ScraperManager(
        videosNum ? Number(videosNum) : undefined, 
        sentinalUser, 
        proxyRegion
    );

    try {
        scraperManager.startScraping(concBrowsNum ? Number(concBrowsNum) : undefined);
        const finalDest = scraperManager.getFinalBucketDestination();
        res.status(202).send({ message: 'Scraping initiated successfully', finalDest });
    } catch (error) {
        logger.error('Error starting scraping', error);
        res.status(500).send({ message: 'Failed to start scraping', error: (error as Error).message });
    }
});

app.get('/get-data', async (req: Request, res: Response) => {
    const { fileName, formatted } = req.query as { fileName: string; formatted: string };

    // if (!fileName) {
    //     return res.status(400).send({ message: 'File name is required' });
    // }

    const dataHandler = new DataHandler('changeLogic'); // Replace 'sentinalUser' with the appropriate value

    try {
        const data = await dataHandler.getDataFromBucket(fileName, formatted === 'true');
        res.status(200).send({ data });
    } catch (error) {
        logger.error('Error retrieving data from S3:', error);
        res.status(404).send({ message: 'File not found or error retrieving data', error: (error as Error).message });
    }
});

app.get('/get-data', async (req: Request, res: Response) => {
    
});

app.listen(PORT, () => {
    logger.info(`>>> Server is up & listening on port ${PORT}`);
});