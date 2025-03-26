import { writeFileSync } from 'fs';
import { CONFIG, logger } from './config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface Video {
    videoId: string;
    authorId: string;
}

class DataHandler {
    private dataFilePath: string;
    private s3Client: S3Client;
    private bucketName: string;
    public dataFileName: string;

    constructor(sentinalUser: string, dataDir: string = CONFIG.DATA_DIR) {
        const dateTime = new Date().toISOString().replace(/[:.]/g, '-');
        this.dataFileName = `${sentinalUser}_${dateTime}.json`;
        this.dataFilePath = `${dataDir}/${this.dataFileName}`;
        this.s3Client = new S3Client({ region: 'eu-north-1' });
        this.bucketName = CONFIG.S3_BUCKET_NAME;
    }

    public saveDataToFile(data: Video[]): void {
        if (!data || data.length === 0) {
            logger.warn('No data to save.');
            return;
        }
        try {
            writeFileSync(this.dataFilePath, JSON.stringify(data));
            logger.info(`Data saved to file: ${this.dataFilePath}`);
        } catch (error) {
            logger.error('Error saving data to file:', error);
        }
    }

    public async saveDataToBucket(data: Video[]): Promise<void> {
        if (!data || data.length === 0) {
            logger.warn('No data to save.');
            return;
        }
        try {
            const params = {
                Bucket: this.bucketName,
                Key: this.dataFileName,
                Body: JSON.stringify(data),
                ContentType: 'application/json',
            };
            const command = new PutObjectCommand(params);
            await this.s3Client.send(command);
            logger.info(`Data saved to S3: ${this.dataFileName}`);
        } catch (error) {
            logger.error('Error saving data to S3:', error);
        }
    }
}

export { DataHandler, Video };