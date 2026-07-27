import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEntity, DocumentStatus, DocumentType } from './entities/document.entity';
import { LoggerService } from '../../common/logger/logger.service';
import * as fs from 'fs';
import * as path from 'path';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(DocumentEntity)
    private documentRepository: Repository<DocumentEntity>,
    private logger: LoggerService,
  ) {}

  async processDocuments(files: Express.Multer.File[]): Promise<any[]> {
    const results = [];
    for (const file of files) {
      try {
        const document = await this.createDocument(file);
        await this.parseDocument(document);
        results.push({ success: true, document });
      } catch (error) {
        this.logger.error(`Failed to process file: ${file.originalname}`, error.stack, 'DocumentService');
        results.push({ success: false, filename: file.originalname, error: error.message });
      }
    }
    return results;
  }

  async createDocument(file: Express.Multer.File): Promise<DocumentEntity> {
    const documentType = this.detectFileType(file.originalname);
    const filePath = path.join(process.env.UPLOAD_DIR || './uploads', file.filename);
    
    // Ensure upload directory exists
    if (!fs.existsSync(process.env.UPLOAD_DIR || './uploads')) {
      fs.mkdirSync(process.env.UPLOAD_DIR || './uploads', { recursive: true });
    }
    
    // Save file
    fs.writeFileSync(filePath, file.buffer);
    
    const document = this.documentRepository.create({
      filename: file.originalname,
      type: documentType,
      filePath,
      status: DocumentStatus.PENDING,
    });
    
    return this.documentRepository.save(document);
  }

  async parseDocument(document: DocumentEntity): Promise<DocumentEntity> {
    document.status = DocumentStatus.PROCESSING;
    await this.documentRepository.save(document);

    try {
      switch (document.type) {
        case DocumentType.PDF:
          await this.parsePDF(document);
          break;
        case DocumentType.WORD:
          await this.parseWord(document);
          break;
        case DocumentType.IMAGE:
        case DocumentType.SCAN:
          await this.parseImage(document);
          break;
        default:
          await this.parseOther(document);
      }

      document.status = DocumentStatus.COMPLETED;
      document.charCount = document.content?.length || 0;
      await this.documentRepository.save(document);

      this.logger.log(`Document ${document.id} processed successfully`, 'DocumentService');
    } catch (error) {
      document.status = DocumentStatus.FAILED;
      document.errorMessage = error.message;
      await this.documentRepository.save(document);
      throw error;
    }

    return document;
  }

  async parsePDF(document: DocumentEntity): Promise<void> {
    const data = fs.readFileSync(document.filePath);
    const pdfData = await pdfParse(data);
    
    document.content = pdfData.text;
    document.pageCount = pdfData.numpages || 1;
    
    // Extract metadata
    document.metadata = {
      author: pdfData.info.Author,
      title: pdfData.info.Title,
      subject: pdfData.info.Subject,
      keywords: pdfData.info.Keywords,
      created: pdfData.info.CreationDate,
      modified: pdfData.info.ModDate,
    };

    // Call multimodal API for table extraction and stamp detection
    await this.extractMultimodalContent(document);
  }

  async parseWord(document: DocumentEntity): Promise<void> {
    const result = await mammoth.extractRawText({ path: document.filePath });
    document.content = result.value;
    
    // Extract metadata from docx
    document.metadata = {
      warnings: result.messages,
    };
  }

  async parseImage(document: DocumentEntity): Promise<void> {
    const worker = createWorker({
      logger: (m) => this.logger.debug(m, 'Tesseract'),
    });

    await worker.load();
    await worker.loadLanguage('chi_sim');
    await worker.initialize('chi_sim');

    const { data: { text } } = await worker.recognize(document.filePath);
    document.content = text;

    await worker.terminate();

    // Handwriting recognition via multimodal API
    await this.extractMultimodalContent(document);
  }

  async parseOther(document: DocumentEntity): Promise<void> {
    // Fallback to text extraction
    try {
      document.content = fs.readFileSync(document.filePath, 'utf-8');
    } catch {
      document.content = '';
    }
  }

  async extractMultimodalContent(document: DocumentEntity): Promise<void> {
    // Simulated multimodal API call
    // In production, this would call an external multimodal LLM service
    document.tables = [];
    document.stamps = [];
    document.handwritings = [];

    // Simulated table extraction
    if (document.content?.length > 0) {
      const tablePattern = /[\s\S]{50,}/g;
      const matches = document.content.match(tablePattern);
      if (matches && matches.length > 0) {
        document.tables = matches.slice(0, 5).map((text, index) => ({
          id: `table_${index}`,
          content: text.substring(0, 200) + '...',
          rows: Math.floor(Math.random() * 10) + 2,
          cols: Math.floor(Math.random() * 5) + 2,
        }));
      }
    }

    // Simulated stamp detection
    document.stamps = [
      { id: 'stamp_1', type: 'official', position: { x: 100, y: 100 } },
    ];

    // Simulated handwriting detection
    document.handwritings = [
      { id: 'hw_1', text: '审批通过', confidence: 0.85 },
    ];
  }

  detectFileType(filename: string): DocumentType {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.pdf':
        return DocumentType.PDF;
      case '.docx':
      case '.doc':
        return DocumentType.WORD;
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.tiff':
      case '.bmp':
        return DocumentType.IMAGE;
      case '.tif':
        return DocumentType.SCAN;
      default:
        return DocumentType.OTHER;
    }
  }

  async getDocuments(page: number, limit: number, status?: DocumentStatus, type?: string): Promise<any> {
    const queryBuilder = this.documentRepository.createQueryBuilder('document');
    
    if (status) {
      queryBuilder.where('document.status = :status', { status });
    }
    
    if (type) {
      queryBuilder.andWhere('document.type = :type', { type });
    }
    
    const [documents, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('document.createdAt', 'DESC')
      .getManyAndCount();
    
    return {
      data: documents,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDocument(id: string): Promise<DocumentEntity> {
    return this.documentRepository.findOneBy({ id });
  }

  async updateDocument(id: string, body: Partial<DocumentEntity>): Promise<DocumentEntity> {
    await this.documentRepository.update(id, body);
    return this.getDocument(id);
  }

  async deleteDocument(id: string): Promise<void> {
    const document = await this.getDocument(id);
    if (document && fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }
    await this.documentRepository.delete(id);
  }

  async batchProcessDocuments(documentIds: string[]): Promise<any[]> {
    const results = [];
    for (const id of documentIds) {
      try {
        const document = await this.getDocument(id);
        if (document && document.status !== DocumentStatus.PROCESSING) {
          await this.parseDocument(document);
          results.push({ success: true, documentId: id });
        } else {
          results.push({ success: false, documentId: id, reason: 'Document not found or already processing' });
        }
      } catch (error) {
        results.push({ success: false, documentId: id, error: error.message });
      }
    }
    return results;
  }

  async getDocumentContent(id: string): Promise<{ content: string; highlights?: any[] }> {
    const document = await this.getDocument(id);
    if (!document) {
      throw new Error('Document not found');
    }
    return {
      content: document.content || '',
      highlights: [],
    };
  }

  async getAllCompletedDocumentIds(): Promise<string[]> {
    const documents = await this.documentRepository.find({
      where: { status: DocumentStatus.COMPLETED },
      select: ['id'],
    });
    return documents.map(doc => doc.id);
  }
}