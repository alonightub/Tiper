import * as express from 'express';
import * as path from 'path';
import { Request, Response } from 'express';
import { Orchestrator, _isOrchestratorBusy } from './orchestrator';
import { Environment, logger } from './config';
import { DataHandler, getDataHandler } from './dataHandler';
import SecretsManager from './secretsManager';

const PORT = process.env.PORT || 3000;
const ENV: Environment = process.env.ENV as Environment || 'dev';
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';

const app = express();
const dataHandler: DataHandler = getDataHandler(USE_LOCAL_STORAGE);
const secretsManager = new SecretsManager(ENV);

// Middleware
app.use((req: Request, res: Response, next) => {
    logger.info(`Received ${req.method} request for ${req.url} with query params: ${JSON.stringify(req.query)}`);
    next();
});
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req: Request, res: Response) => {
    res.status(200).send({ status: 'OK' });
});

app.get('/init-collection', async (req: Request, res: Response) => {
    const { videosNum, sentinalUser, proxyRegion, concBrowsNum } = req.query as { videosNum: string; sentinalUser: string, proxyRegion: string, concBrowsNum: string };
    
    try {
        const orchestrator = new Orchestrator(
            Number(videosNum),
            sentinalUser,
            proxyRegion,
            dataHandler,
            secretsManager
        );

        orchestrator.startScraping(Number(concBrowsNum));
        const finalDest = orchestrator.dataFileName;
        res.status(202).send({ message: 'Scraping initiated successfully', finalDest });
    } catch (error) {
        logger.error('Error starting scraping', error);
        res.status(500).send({ message: 'Failed to start scraping', error: (error as Error).message });
    }
});

app.get('/get-data', async (req: Request, res: Response) => {
    const { fileName, formatted } = req.query as { fileName: string; formatted: string };

    if (!fileName) {
        res.status(400).send({ message: 'File name is required' });
    }

    try {
        const data = await dataHandler.getData(fileName, formatted === 'true');
        res.status(200).send({ data });
    } catch (error) {
        logger.error('Error retrieving data from S3:', error);
        res.status(404).send({ message: 'File not found or error retrieving data', error: (error as Error).message });
    }
});

app.post('/add-mole', async (req: Request, res: Response) => {
    const { name, content } = req.body;

    if (!name || !content) {
        res.status(400).send({ message: 'Name and content are required' });
        return;
    }

    try {
        await secretsManager.addNewMole(name, content);
        const moles = await secretsManager.listMoles();
        res.status(201).send({ message: 'Mole added successfully', availableMoles: moles });
    } catch (error) {
        logger.error('Error adding new mole:', error);
        res.status(500).send({ message: 'Failed to add mole', error: (error as Error).message });
    }
});

app.get('/delete-mole', async (req: Request, res: Response) => {
    const { name } = req.query as { name: string };

    if (!name) {
        res.status(400).send({ message: 'Name is required' });
        return;
    }

    try {
        await secretsManager.deleteMole(name);
        const moles = await secretsManager.listMoles();
        res.status(200).send({ message: 'Mole deleted successfully', availableMoles: moles });
    } catch (error) {
        logger.error('Error deleting mole:', error);
        res.status(500).send({ message: 'Failed to delete mole', error: (error as Error).message });
    }
});

app.get('/status', async (req: Request, res: Response) => {
    try {
        const moles = await secretsManager.listMoles();
        res.status(200).send({ availableMoles: moles, isCollectionInProgress: _isOrchestratorBusy });
    } catch (error) {
        logger.error('Error retrieving moles from SecretsManager:', error);
        res.status(500).send({ message: 'Failed to retrieve moles', error: (error as Error).message });
    }
});

app.get('/thomas', (req: Request, res: Response) => {
    const imagePath = path.join(__dirname, '../data', 'thomas.png');
    res.status(200).sendFile(imagePath);
});

app.listen(PORT, async () => {
    await secretsManager.initProxy();
    logger.info(`>>> Server is up & listening on port ${PORT}`);
});