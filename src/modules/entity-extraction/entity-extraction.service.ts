import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractedEntity, EntityType } from './entities/extracted-entity.entity';
import { ExtractedRelation, RelationType } from './entities/extracted-relation.entity';
import { DocumentService } from '../document/document.service';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class EntityExtractionService {
  constructor(
    @InjectRepository(ExtractedEntity)
    private entityRepository: Repository<ExtractedEntity>,
    @InjectRepository(ExtractedRelation)
    private relationRepository: Repository<ExtractedRelation>,
    private documentService: DocumentService,
    private logger: LoggerService,
  ) {}

  async extractEntitiesAndRelations(documentId: string): Promise<{ entities: ExtractedEntity[]; relations: ExtractedRelation[] }> {
    const document = await this.documentService.getDocument(documentId);
    if (!document || !document.content) {
      throw new Error('Document not found or has no content');
    }

    const entities = await this.extractEntities(document.content, documentId);
    const relations = await this.extractRelations(entities, document.content, documentId);

    await this.entityRepository.save(entities);
    await this.relationRepository.save(relations);

    this.logger.log(`Extracted ${entities.length} entities and ${relations.length} relations from document ${documentId}`, 'EntityExtractionService');

    return { entities, relations };
  }

  async extractEntities(content: string, documentId: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    // Extract persons (Chinese names)
    const personPattern = /[\u4e00-\u9fa5]{2,4}(?:[·.][\u4e00-\u9fa5]{1,4})*/g;
    const persons = content.match(personPattern) || [];
    const uniquePersons = [...new Set(persons.filter((p) => !this.isCommonWord(p)))];
    
    for (const name of uniquePersons.slice(0, 20)) {
      const entity = this.entityRepository.create({
        name,
        type: EntityType.PERSON,
        confidence: 0.7 + Math.random() * 0.3,
        documentId,
      });
      entities.push(entity);
    }

    // Extract organizations
    const orgPattern = /[\u4e00-\u9fa5]+(?:公司|集团|机构|协会|大学|学院|研究所|委员会|部|局|厅|处)/g;
    const orgs = content.match(orgPattern) || [];
    const uniqueOrgs = [...new Set(orgs)];
    
    for (const name of uniqueOrgs.slice(0, 10)) {
      const entity = this.entityRepository.create({
        name,
        type: EntityType.ORGANIZATION,
        confidence: 0.75 + Math.random() * 0.25,
        documentId,
      });
      entities.push(entity);
    }

    // Extract locations
    const locationPattern = /[\u4e00-\u9fa5]+(?:省|市|区|县|镇|村|街道|路|巷|号)/g;
    const locations = content.match(locationPattern) || [];
    const uniqueLocations = [...new Set(locations)];
    
    for (const name of uniqueLocations.slice(0, 15)) {
      const entity = this.entityRepository.create({
        name,
        type: EntityType.LOCATION,
        confidence: 0.8 + Math.random() * 0.2,
        documentId,
      });
      entities.push(entity);
    }

    // Extract dates
    const datePattern = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?)|(\d{4}年\d{1,2}月)|(\d{4}[-/]\d{2}[-/]\d{2})/g;
    const dates = content.match(datePattern) || [];
    const uniqueDates = [...new Set(dates)];
    
    for (const name of uniqueDates.slice(0, 20)) {
      const entity = this.entityRepository.create({
        name,
        type: EntityType.DATE,
        confidence: 0.9 + Math.random() * 0.1,
        documentId,
      });
      entities.push(entity);
    }

    // Extract events
    const eventKeywords = ['会议', '活动', '事件', '运动', '战役', '谈判', '协议', '条约', '声明'];
    for (const keyword of eventKeywords) {
      const eventPattern = new RegExp(`[\\u4e00-\\u9fa5]+${keyword}`, 'g');
      const events = content.match(eventPattern) || [];
      for (const name of [...new Set(events)].slice(0, 5)) {
        const entity = this.entityRepository.create({
          name,
          type: EntityType.EVENT,
          confidence: 0.6 + Math.random() * 0.3,
          documentId,
        });
        entities.push(entity);
      }
    }

    return entities;
  }

  async extractRelations(entities: ExtractedEntity[], content: string, documentId: string): Promise<ExtractedRelation[]> {
    const relations: ExtractedRelation[] = [];
    
    const personEntities = entities.filter((e) => e.type === EntityType.PERSON);
    const orgEntities = entities.filter((e) => e.type === EntityType.ORGANIZATION);
    const locationEntities = entities.filter((e) => e.type === EntityType.LOCATION);
    const eventEntities = entities.filter((e) => e.type === EntityType.EVENT);

    // Person - Organization relations
    for (const person of personEntities) {
      for (const org of orgEntities) {
        if (content.includes(person.name) && content.includes(org.name)) {
          const distance = Math.abs(content.indexOf(person.name) - content.indexOf(org.name));
          if (distance < 500) {
            const relation = this.relationRepository.create({
              sourceEntityId: person.id,
              targetEntityId: org.id,
              relationType: Math.random() > 0.5 ? RelationType.EMPLOYED_BY : RelationType.AFFILIATED_WITH,
              confidence: 0.6 + Math.random() * 0.3,
              documentId,
              context: { distance },
            });
            relations.push(relation);
          }
        }
      }
    }

    // Event - Location relations
    for (const event of eventEntities) {
      for (const location of locationEntities) {
        if (content.includes(event.name) && content.includes(location.name)) {
          const relation = this.relationRepository.create({
            sourceEntityId: event.id,
            targetEntityId: location.id,
            relationType: RelationType.LOCATED_AT,
            confidence: 0.7 + Math.random() * 0.2,
            documentId,
          });
          relations.push(relation);
        }
      }
    }

    // Event - Person relations
    for (const event of eventEntities) {
      for (const person of personEntities) {
        if (content.includes(event.name) && content.includes(person.name)) {
          const relation = this.relationRepository.create({
            sourceEntityId: event.id,
            targetEntityId: person.id,
            relationType: RelationType.INVOLVES,
            confidence: 0.65 + Math.random() * 0.25,
            documentId,
          });
          relations.push(relation);
        }
      }
    }

    // Person - Location relations
    for (const person of personEntities) {
      for (const location of locationEntities) {
        if (content.includes(person.name) && content.includes(location.name)) {
          const relation = this.relationRepository.create({
            sourceEntityId: person.id,
            targetEntityId: location.id,
            relationType: RelationType.LOCATED_AT,
            confidence: 0.5 + Math.random() * 0.3,
            documentId,
          });
          relations.push(relation);
        }
      }
    }

    // Document references relations
    const docRefPattern = /(参见|参考|引用|源自)[\u4e00-\u9fa5]*(文件|报告|资料|档案)/g;
    if (content.match(docRefPattern)) {
      for (let i = 0; i < Math.min(3, entities.length); i++) {
        for (let j = i + 1; j < Math.min(i + 3, entities.length); j++) {
          const relation = this.relationRepository.create({
            sourceEntityId: entities[i].id,
            targetEntityId: entities[j].id,
            relationType: RelationType.REFERENCES,
            confidence: 0.5 + Math.random() * 0.3,
            documentId,
          });
          relations.push(relation);
        }
      }
    }

    return relations;
  }

  private isCommonWord(word: string): boolean {
    const commonWords = ['的', '是', '在', '有', '和', '了', '我', '你', '他', '她', '它', '这', '那', '什么', '怎么', '为什么', '因为', '所以', '但是', '如果', '可以', '可能', '应该', '必须', '需要', '已经', '正在', '将要', '曾经', '从来', '总是', '经常', '偶尔', '很少', '几乎', '大概', '大约', '左右', '前后', '上下', '多少', '大小', '长短', '高低', '远近', '快慢', '好坏', '对错', '真假', '新旧', '轻重', '冷热', '软硬', '早晚', '先后', '内外', '进出', '开关', '买卖', '来去', '生死', '父母', '子女', '兄弟', '姐妹', '朋友', '同学', '同事', '老师', '学生', '医生', '病人', '警察', '军人', '工人', '农民', '商人', '官员', '市民', '居民', '游客', '旅客', '顾客', '客户', '用户', '会员', '员工', '经理', '主管', '老板', '董事长', '总经理', '秘书', '助理', '顾问', '专家', '学者', '教授', '研究员', '工程师', '设计师', '程序员', '律师', '会计师', '建筑师', '艺术家', '作家', '记者', '编辑', '导演', '演员', '歌手', '运动员', '冠军', '亚军', '季军', '第一名', '第二名', '第三名', '优秀', '良好', '中等', '及格', '不及格', '先进', '模范', '标兵', '能手', '权威', '著名', '知名', '杰出', '卓越', '伟大', '重要', '关键', '核心', '主要', '次要', '辅助', '基础', '根本', '本质', '实质', '表面', '现象', '原因', '结果', '过程', '方法', '手段', '途径', '方式', '策略', '计划', '方案', '项目', '任务', '工作', '活动', '会议', '讨论', '研究', '分析', '解决', '处理', '管理', '领导', '组织', '协调', '沟通', '交流', '合作', '竞争', '发展', '进步', '改革', '创新', '建设', '开发', '生产', '制造', '销售', '服务', '消费', '投资', '融资', '贷款', '借款', '还款', '利息', '利润', '亏损', '收入', '支出', '成本', '费用', '预算', '决算', '审计', '检查', '监督', '评估', '考核', '评价', '奖励', '惩罚', '表扬', '批评', '警告', '处罚', '罚款', '没收', '赔偿', '补偿', '救济', '救助', '帮助', '支持', '援助', '捐赠', '赞助', '创业', '就业', '失业', '退休', '辞职', '解雇', '招聘', '培训', '学习', '教育', '考试', '认证', '证书', '文凭', '学位', '学历', '专业', '学科', '课程', '教材', '教学', '实验', '测试', '验证', '证明', '证据', '数据', '信息', '知识', '技术', '技能', '能力', '经验', '教训', '问题', '困难', '挑战', '机遇', '风险', '危机', '安全', '危险', '事故', '灾害', '灾难', '战争', '和平', '冲突', '协议', '条约', '合同', '法律', '法规', '政策', '制度', '规定', '规则', '标准', '规范', '程序', '流程', '步骤', '技巧', '窍门', '秘诀', '原理', '理论', '概念', '定义', '解释', '说明', '描述', '表达', '对话', '谈判', '协商', '辩论', '争论', '争吵', '分歧', '一致', '同意', '反对', '赞成', '否定', '肯定', '确认', '否认', '承认', '拒绝', '接受', '批准', '否决', '通过', '决议', '决定', '结论', '成果', '成就', '成绩', '业绩', '贡献', '功劳', '责任', '义务', '权利', '权力', '利益', '价值', '意义', '重要性', '必要性', '可能性', '可行性', '合理性', '合法性', '合规性', '安全性', '可靠性', '稳定性', '有效性', '效率', '效益', '效果', '影响', '作用', '功能', '性能', '质量', '数量', '规模', '程度', '水平', '层次', '级别', '等级', '种类', '类型', '形式', '模式', '风格', '特点', '特征', '属性', '特性', '性质', '状态', '情况', '状况', '情形', '形势', '趋势', '方向', '目标', '目的', '意图', '动机', '原因', '理由', '借口', '陈述', '声明', '公告', '通知', '消息', '新闻', '报道', '文章', '报告', '文件', '资料', '档案', '记录', '日志', '日记', '笔记', '备忘录', '摘要', '总结', '论文', '著作', '书籍', '杂志', '报纸', '期刊', '出版物', '网络', '网站', '网页', '博客', '论坛', '社区', '社交媒体', '平台', '系统', '软件', '应用', '程序', '工具', '设备', '机器', '仪器', '材料', '产品', '商品', '货物', '业务', '行业', '产业', '经济', '市场', '价格', '货币', '金融', '银行', '保险', '证券', '股票', '基金', '债券', '期货', '期权', '外汇', '汇率', '利率', '税率', '税收', '财政', '赤字', '盈余', '债务', '债权', '资产', '负债', '净资产', '回报', '收益', '收益率', '增长率', '下降率', '比例', '百分比', '倍数', '指数', '指标', '统计', '预测', '规律', '周期', '阶段', '创新', '研发', '设计', '发布', '推广', '营销', '渠道', '份额', '战略', '执行', '实施', '团队', '结构', '文化', '价值观', '使命', '愿景', '战术', '资源', '人力', '物力', '财力', '时间', '健康', '环境', '社会责任', '可持续发展', '绿色', '低碳', '环保', '节能', '减排', '循环', '再生', '人才', '智慧', '大数据', '云计算', '物联网', '区块链', '元宇宙', '数字化', '智能化', '自动化', '机器人', '传感器', '芯片', '半导体', '硬件', '通信', '5G', '互联网', '移动', '生态', '架构', '运维', '隐私', '合规', '治理', '决策', '监控', '调整', '优化', '持续', '改进', '卓越', '体系', '认证', '荣誉', '奖项', '认可', '表彰', '激励', '动力', '热情', '激情', '专注', '坚持', '努力', '奋斗', '拼搏', '成功', '失败', '挫折', '希望', '梦想', '信念', '信仰', '道德', '伦理', '公平', '公正', '透明', '诚信', '廉洁', '自律', '自觉', '自省', '自我', '成长', '提升', '超越', '突破', '创造', '发现', '发明', '探索', '指导', '辅导', '咨询', '精通', '熟练', '掌握', '熟悉', '明白', '理解', '认识', '意识', '观念', '思想', '思维', '逻辑', '推理', '判断', '选择', '权衡', '取舍', '利弊', '得失', '成败', '输赢', '胜负', '存亡', '兴衰', '荣辱', '进退', '缓急', '主次', '正负', '增减', '升降', '起伏', '波动', '平衡', '协调', '和谐', '统一', '对立', '矛盾', '融合', '差异', '相似', '接近', '远离', '分离', '结合', '连接', '断开', '开启', '关闭', '暂停', '恢复', '重复', '循环', '连续', '间断', '即将', '立刻', '迅速', '快速', '缓慢', '逐渐', '突然', '意外', '偶然', '必然', '一定', '大概', '差不多', '完全', '部分', '全部', '整体', '局部', '个别', '普遍', '一般', '特殊', '特别', '格外', '尤其', '更加', '非常', '十分', '极其', '相当', '比较', '稍微', '略微', '一点', '一些', '许多', '大量', '少量', '少许', '若干', '所有', '任何', '每一个', '各个', '各自', '彼此', '互相', '相互', '一起', '共同', '单独', '独自', '亲自', '亲身', '直接', '间接', '主动', '被动', '自愿', '被迫', '故意', '无意', '有心', '无心', '有意', '自然', '当然', '显然', '明显', '清楚', '清晰', '模糊', '隐约', '朦胧', '暗淡', '明亮', '鲜艳', '混乱', '有序', '整齐', '杂乱', '干净', '肮脏', '清洁', '污染', '卫生', '疾病', '痛苦', '快乐', '悲伤', '喜悦', '愤怒', '平静', '激动', '兴奋', '紧张', '放松', '焦虑', '担忧', '害怕', '恐惧', '勇敢', '懦弱', '坚强', '脆弱', '自信', '自卑', '谦虚', '骄傲', '诚实', '虚伪', '善良', '邪恶', '宽容', '狭隘', '慷慨', '吝啬', '勤劳', '懒惰', '认真', '马虎', '细心', '粗心', '耐心', '急躁', '冷静', '冲动', '理智', '情感', '理性', '感性', '客观', '主观', '公正', '偏见', '公平', '偏袒', '正义', '合法', '非法', '正确', '错误', '对', '错', '是', '否', '存在', '不存在', '应该', '不应该', '可以', '不可以', '能', '不能', '会', '不会', '知道', '不知道', '了解', '不了解', '相信', '不相信', '怀疑', '信任', '不信任', '喜欢', '不喜欢', '爱', '恨', '讨厌', '欣赏', '厌恶', '尊重', '轻视', '重视', '忽视', '关心', '不关心', '在意', '不在意', '感兴趣', '不感兴趣', '满意', '不满意', '高兴', '不高兴', '赞成', '抵制', '接受', '承认', '否认', '质疑', '假设', '猜想', '推测', '推断', '归纳', '演绎', '综合', '对比', '类比', '比喻', '象征', '代表', '传达', '传递', '合作', '对抗', '妥协', '让步', '放弃', '继续', '停止', '开始', '结束', '进行', '完成', '实现', '达到', '获得', '取得', '得到', '失去', '丢失', '找回', '归还', '赠送', '拒绝', '给予', '索取', '付出', '收获', '投入', '产出', '成功', '胜利', '进步', '退步', '上升', '下降', '增长', '减少', '扩大', '缩小', '提高', '降低', '加强', '削弱', '改善', '恶化', '变好', '变坏', '发展', '衰退', '繁荣', '萧条', '动荡', '安全', '危险', '合作', '支持', '反对', '不同意', '符合', '不符合', '遵守', '违反', '服从', '反抗', '超过', '不足', '满足', '未满足', '落空', '达成', '未达成', '未完成', '未实现', '未达到'];
    return commonWords.includes(word);
  }

  async getEntities(page: number, limit: number, type?: EntityType, documentId?: string, name?: string): Promise<any> {
    const queryBuilder = this.entityRepository.createQueryBuilder('entity');
    
    if (type) {
      queryBuilder.where('entity.type = :type', { type });
    }
    
    if (documentId) {
      queryBuilder.andWhere('entity.documentId = :documentId', { documentId });
    }
    
    if (name) {
      queryBuilder.andWhere('entity.name LIKE :name', { name: `%${name}%` });
    }
    
    const [entities, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('entity.createdAt', 'DESC')
      .getManyAndCount();
    
    return {
      data: entities,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEntity(id: string): Promise<ExtractedEntity> {
    return this.entityRepository.findOneBy({ id });
  }

  async updateEntity(id: string, body: Partial<ExtractedEntity>): Promise<ExtractedEntity> {
    await this.entityRepository.update(id, body);
    return this.getEntity(id);
  }

  async deleteEntity(id: string): Promise<void> {
    await this.entityRepository.delete(id);
  }

  async getRelations(page: number, limit: number, type?: RelationType, documentId?: string, sourceEntityId?: string, targetEntityId?: string): Promise<any> {
    const queryBuilder = this.relationRepository.createQueryBuilder('relation');
    
    if (type) {
      queryBuilder.where('relation.relationType = :type', { type });
    }
    
    if (documentId) {
      queryBuilder.andWhere('relation.documentId = :documentId', { documentId });
    }
    
    if (sourceEntityId) {
      queryBuilder.andWhere('relation.sourceEntityId = :sourceEntityId', { sourceEntityId });
    }
    
    if (targetEntityId) {
      queryBuilder.andWhere('relation.targetEntityId = :targetEntityId', { targetEntityId });
    }
    
    const [relations, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('relation.createdAt', 'DESC')
      .getManyAndCount();
    
    return {
      data: relations,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRelation(id: string): Promise<ExtractedRelation> {
    return this.relationRepository.findOneBy({ id });
  }

  async updateRelation(id: string, body: Partial<ExtractedRelation>): Promise<ExtractedRelation> {
    await this.relationRepository.update(id, body);
    return this.getRelation(id);
  }

  async deleteRelation(id: string): Promise<void> {
    await this.relationRepository.delete(id);
  }

  /**
   * 查找已存在的同名同类型实体（跨文档实体匹配）
   * @param name 实体名称
   * @param type 实体类型
   * @param excludeDocumentId 排除的文档ID（用于查找其他文档中的同名实体）
   */
  async findExistingEntity(name: string, type: EntityType, excludeDocumentId?: string): Promise<ExtractedEntity | null> {
    const queryBuilder = this.entityRepository
      .createQueryBuilder('entity')
      .where('entity.name = :name AND entity.type = :type', { name, type });

    if (excludeDocumentId) {
      queryBuilder.andWhere('entity.documentId != :excludeDocumentId', { excludeDocumentId });
    }

    return queryBuilder.getOne();
  }

  /**
   * 查找所有同名同类型实体（跨文档）
   * @param name 实体名称
   * @param type 实体类型
   */
  async findAllEntitiesByName(name: string, type: EntityType): Promise<ExtractedEntity[]> {
    return this.entityRepository.find({
      where: { name, type },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 获取实体的跨文档关联关系
   * @param entityId 实体ID
   */
  async getCrossDocumentRelations(entityId: string): Promise<ExtractedRelation[]> {
    const entity = await this.getEntity(entityId);
    if (!entity) {
      return [];
    }

    // 查找同名同类型的其他实体
    const sameEntities = await this.findAllEntitiesByName(entity.name, entity.type);
    const otherEntityIds = sameEntities.filter(e => e.id !== entityId).map(e => e.id);

    if (otherEntityIds.length === 0) {
      return [];
    }

    // 查找这些实体的所有关系
    const relations = await this.relationRepository
      .createQueryBuilder('relation')
      .where('relation.sourceEntityId IN (:...ids) OR relation.targetEntityId IN (:...ids)', { ids: otherEntityIds })
      .getMany();

    return relations;
  }

  async batchExtractEntitiesAndRelations(documentIds: string[]): Promise<any[]> {
    const results = [];
    for (const documentId of documentIds) {
      try {
        const { entities, relations } = await this.extractEntitiesAndRelations(documentId);
        results.push({ success: true, documentId, entityCount: entities.length, relationCount: relations.length });
      } catch (error) {
        results.push({ success: false, documentId, error: error.message });
      }
    }
    return results;
  }
}