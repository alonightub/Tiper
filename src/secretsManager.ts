import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { Environment, logger, Proxy } from "./config";
import * as fs from 'fs';
import * as path from 'path';

const AWS_SECRETS_MANAGER_REGION = 'eu-north-1';
const DEFAULT_SECRETS_DIR = '../secrets';

class SecretsManager {
    private proxy?: Proxy;
    private env: Environment;
    private secretsDir: string;
    private cookies: any;

    constructor(env: Environment, secretsDir: string = DEFAULT_SECRETS_DIR) {
        this.env = env;
        this.secretsDir = path.resolve(__dirname, '../secrets');
    }

    public getProxy(): Proxy {
        if (!this.proxy) {
            throw Error("Proxy not initialized. Call initProxy() first.");
        }
        return this.proxy;
    }

    public async initProxy(): Promise<Boolean> {
        const proxy_secret_name = `${this.env}/tiper/proxy`;

        const client = new SecretsManagerClient({
            region: AWS_SECRETS_MANAGER_REGION,
        });

        try {
            const response = await client.send(
                new GetSecretValueCommand({
                    SecretId: proxy_secret_name,
                })
            );
            if (!response.SecretString) {
                logger.error(`Secret ${proxy_secret_name} not found`);
                return false;
            }

            this.proxy = JSON.parse(response.SecretString);
            logger.info(`Proxy initialized successfully: ${this.proxy?.server}`);
        } catch (error) {
            logger.error(`Error retrieving secret ${proxy_secret_name}:`, error);
            return false;
        }
        return true;
    }

    public addNewMole(fileName: string, content: string): void {
        const filePath = path.join(this.secretsDir, fileName);

        try {
            if (!fs.existsSync(this.secretsDir)) {
                fs.mkdirSync(this.secretsDir, { recursive: true });
            }

            fs.writeFileSync(filePath, JSON.stringify(content), { encoding: 'utf8' });
            logger.info(`Secret file ${fileName} added/updated successfully.`);
        } catch (error) {
            logger.error(`Error adding/updating secret file ${fileName}:`, error);
        }
    }
    
    public deleteMole(fileName: string): void {
        const filePath = path.join(this.secretsDir, fileName);

        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info(`Secret file ${fileName} deleted successfully.`);
            } else {
                logger.warn(`Secret file ${fileName} does not exist.`);
            }
        } catch (error) {
            logger.error(`Error deleting secret file ${fileName}:`, error);
        }
    }

    public listMoles(): string[] {
        const secretsDir = path.resolve(__dirname, '../secrets');
        try {
            return fs.readdirSync(secretsDir);
        } catch (error) {
            logger.error(`Error reading secrets directory:`, error);
            return [];
        }
    }
}

export default SecretsManager;