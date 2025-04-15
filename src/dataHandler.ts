import { readFileSync, writeFileSync } from 'fs';
import { CONFIG, logger } from './config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const DATA_DIR = './data';
const AWS_BUCKET_REGION = 'eu-north-1';

const getDataHandler = (localStorage = false): DataHandler => {
    if (localStorage) {
        return new LocalStorage();
    }
    return new S3Storage();
}

interface DataHandler {
    saveData(data: any[], fileName: string): Promise<boolean>;
    getData(fileName: string, formatted: boolean): Promise<any>;
}

class LocalStorage implements DataHandler {
    private dataDir: string;

    constructor(dataDir: string = DATA_DIR) {
        this.dataDir = dataDir;
    }

    public async getData(fileName: string, formatted: boolean = false): Promise<any> {
        const filePath = `${this.dataDir}/${fileName}`;
        try {
            const fileData = readFileSync(filePath, 'utf-8')
            const data = JSON.parse(fileData);
            if (formatted) {
                return this.formatData(data);
            }
            return data;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Error reading file from local storage: ${error.message}`);
            } else {
                logger.error(`Error reading file from local storage: ${error}`);
            }
        }
        return [];
    }

    public saveData(data: any[], fileName: string): Promise<boolean> {
        if (!data || data.length === 0) {
            logger.warn('No data to save.');
        }
        try {
            const filePath = `${this.dataDir}/${fileName}`;
            writeFileSync(filePath, JSON.stringify(data));
            logger.info(`Data saved to file: ${filePath}`);
            return Promise.resolve(true);
        } catch (error) {
            logger.error('Error saving data to file:', error);
        }
        return Promise.resolve(false);
    }

    public formatData(data: any[]): string[] {
        return data;
    }
}


class S3Storage implements DataHandler {
    private s3Client: S3Client;
    private bucketName: string;

    constructor() {
        this.s3Client = new S3Client({ region: AWS_BUCKET_REGION });
        this.bucketName = CONFIG.S3_BUCKET_NAME;
    }

    public async saveData(data: any[], fileName: string): Promise<boolean> {
        if (!data || data.length === 0) {
            logger.warn('No data to save.');
            return false;
        }
        try {
            const params = {
                Bucket: this.bucketName,
                Key: fileName,
                Body: JSON.stringify(data),
                ContentType: 'application/json',
            };
            const command = new PutObjectCommand(params);
            await this.s3Client.send(command);
            logger.info(`Data saved to S3: ${fileName}`);
            return true;
        } catch (error) {
            logger.error('Error saving data to S3:', error);
        }
        return false;
    }

    public async getData(fileName: string, formatted: boolean = false): Promise<any> {
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
            if (formatted) {
                return this.formatData(data);
            }
            return data;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Error retrieving file from S3: ${error.message}`);
            } else {
                logger.error(`Error retrieving file from S3: ${error}`);
            }
        }
        return [];
    }

    public formatData(data: any[]): string {
        const urlsArr: string[] = data.map((item: any) => {
            const uniqueId = item.author.uniqueId;
            return `https://www.tiktok.com/@${uniqueId}/video/${item.id}`;
        });
        return urlsArr.join('\n');
    }
}

export { DataHandler, LocalStorage, S3Storage, getDataHandler };