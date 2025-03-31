import { writeFileSync } from 'fs';
import { CONFIG, logger } from './config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

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

    public async getDataFromBucket(fileName: string, formatted: boolean): Promise<any> {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: fileName,
            };
            const command = new GetObjectCommand(params);
            const response = await this.s3Client.send(command);

            if (!response.Body) {
                throw new Error('File not found or empty');
            }

            const streamToString = (stream: Readable): Promise<string> =>
                new Promise((resolve, reject) => {
                    const chunks: any[] = [];
                    stream.on('data', (chunk) => chunks.push(chunk));
                    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
                    stream.on('error', reject);
                });

            const rawData = await streamToString(response.Body as Readable);
            const data = JSON.parse(rawData);

            if (!formatted) {
                return data;
            }

            const formattedData = data.map((item: any) => {
                const uniqueId = item.author.uniqueId;
                return `https://www.tiktok.com/@${uniqueId}/video/${item.id}`;
            });

            return formattedData;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error retrieving file from S3: ${error.message}`);
            } else {
                throw new Error('Error retrieving file from S3: Unknown error');
            }
        }
    }
}

export { DataHandler, Video };