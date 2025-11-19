/**
 * 齿轮分析主模块
 * 整合所有子模块，提供统一的接口
 */

class GearAnalysis {
    constructor() {
        // 检查依赖类是否已定义
        console.log('GearAnalysis 构造函数开始');
        console.log('GearFileParser:', typeof GearFileParser);
        console.log('GearPointUtils:', typeof GearPointUtils);
        console.log('GearToothCount:', typeof GearToothCount);
        console.log('GearCircleFitting:', typeof GearCircleFitting);
        console.log('GearRegistration:', typeof GearRegistration);
        console.log('GearGrade:', typeof GearGrade);
        
        // 初始化子模块
        this.fileParser = new GearFileParser();
        this.pointUtils = new GearPointUtils();
        
        if (typeof GearToothCount === 'undefined') {
            console.error('GearToothCount 未定义！请检查 gear-tooth-count.js 是否已加载');
            throw new Error('GearToothCount 未定义');
        }
        
        try {
            // 使用不同的属性名避免与getter/setter冲突
            this._toothCountCalculator = new GearToothCount();
            console.log('toothCountCalculator 实例创建成功:', this._toothCountCalculator);
            console.log('toothCountCalculator 类型:', typeof this._toothCountCalculator);
            console.log('toothCountCalculator 构造函数:', this._toothCountCalculator.constructor);
            console.log('toothCountCalculator.calculateToothCountFromProfile:', typeof this._toothCountCalculator.calculateToothCountFromProfile);
            
            if (!this._toothCountCalculator) {
                throw new Error('GearToothCount 实例创建失败，返回值为空');
            }
            
            if (typeof this._toothCountCalculator.calculateToothCountFromProfile !== 'function') {
                console.error('calculateToothCountFromProfile 不是函数！');
                console.error('toothCountCalculator 的所有方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(this._toothCountCalculator)));
                throw new Error('calculateToothCountFromProfile 方法不存在');
            }
        } catch (error) {
            console.error('创建 GearToothCount 实例时出错:', error);
            throw error;
        }
        
        this.circleFitting = new GearCircleFitting();
        this.registration = new GearRegistration();
        this.grade = new GearGrade();
        
        // 数据存储
        this.profilePoints = [];
        this.cadPoints = [];
        this.toothCountValue = 0;
        this.addendumRadius = 0;
        this.dedendumRadius = 0;
        this.registrationTransform = null;
        
        console.log('GearAnalysis 构造函数完成');
    }

    // ========== 文件解析方法 ==========
    parseProfileFile(content, filename) {
        return this.fileParser.parseProfileFile(content, filename);
    }

    parseDXFFile(content) {
        return this.fileParser.parseDXFFile(content);
    }

    sortPointsByAngle(points) {
        return this.fileParser.sortPointsByAngle(points);
    }

    // ========== 点云处理方法 ==========
    calculatePolarCoordinates(points) {
        return this.pointUtils.calculatePolarCoordinates(points);
    }

    // ========== 齿数计算方法 ==========
    calculateToothCountFromProfile(polarData) {
        console.log('GearAnalysis.calculateToothCountFromProfile 被调用');
        
        // 使用 _toothCountCalculator 而不是 toothCount（避免与getter冲突）
        if (!this._toothCountCalculator) {
            console.warn('_toothCountCalculator 未初始化，尝试重新初始化...');
            if (typeof GearToothCount !== 'undefined') {
                try {
                    this._toothCountCalculator = new GearToothCount();
                    console.log('重新初始化成功:', this._toothCountCalculator);
                } catch (error) {
                    console.error('重新初始化失败:', error);
                    throw new Error('toothCount 模块初始化失败: ' + error.message);
                }
            } else {
                console.error('GearToothCount 类未定义！');
                throw new Error('GearToothCount 类未定义，无法初始化 toothCount 模块');
            }
        }
        
        const result = this._toothCountCalculator.calculateToothCountFromProfile(polarData);
        this.toothCountValue = result;
        // 保存分析结果供可视化使用
        this.toothCountAnalysis = this._toothCountCalculator.toothCountAnalysis;
        // 调试信息
        console.log('齿数计算结果:', result);
        if (this.toothCountAnalysis) {
            console.log('toothCountAnalysis 已保存:', {
                method1: this.toothCountAnalysis.method1,
                method2: this.toothCountAnalysis.method2,
                method3: this.toothCountAnalysis.method3,
                final: this.toothCountAnalysis.final,
                polarDataLength: this.toothCountAnalysis.polarData?.length
            });
        }
        return result;
    }

    get toothCount() {
        return this.toothCountValue;
    }

    set toothCount(value) {
        this.toothCountValue = value;
    }

    // ========== 圆拟合方法 ==========
    fitCircle(points) {
        return this.circleFitting.fitCircle(points);
    }

    fitAddendumAndDedendumCircles(points, toothCount) {
        return this.circleFitting.fitAddendumAndDedendumCircles(points, toothCount);
    }

    // ========== 配准方法 ==========
    pointToLineDistance(point, lineStart, lineEnd) {
        return this.registration.pointToLineDistance(point, lineStart, lineEnd);
    }

    pointToContourDistance(point, contour) {
        return this.registration.pointToContourDistance(point, contour);
    }

    icpRegistration(sourcePoints, targetPoints, maxIterations = 50) {
        return this.registration.icpRegistration(sourcePoints, targetPoints, maxIterations);
    }

    calculateProfileError(measuredPoints, cadContour, transform) {
        return this.registration.calculateProfileError(measuredPoints, cadContour, transform);
    }

    // ========== 齿轮等级方法 ==========
    calculateISOGrade(pitchDiameter, singlePitchError, cumulativePitchError, profileError) {
        return this.grade.calculateISOGrade(
            pitchDiameter, 
            this.toothCountValue, 
            singlePitchError, 
            cumulativePitchError, 
            profileError
        );
    }

    calculateJISGrade(pitchDiameter, singlePitchError, cumulativePitchError, profileError) {
        return this.grade.calculateJISGrade(
            pitchDiameter, 
            this.toothCountValue, 
            singlePitchError, 
            cumulativePitchError, 
            profileError
        );
    }

    calculateGBKGrade(pitchDiameter, singlePitchError, cumulativePitchError, profileError) {
        return this.grade.calculateGBKGrade(
            pitchDiameter, 
            this.toothCountValue, 
            singlePitchError, 
            cumulativePitchError, 
            profileError
        );
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearAnalysis;
}
