/**
 * 齿轮分析主模块
 * 整合所有子模块，提供统一的接口
 */

class GearAnalysis {
    constructor() {
        // 初始化子模块
        this.fileParser = new GearFileParser();
        this.pointUtils = new GearPointUtils();
        this.toothCount = new GearToothCount();
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
        const result = this.toothCount.calculateToothCountFromProfile(polarData);
        this.toothCountValue = result;
        // 保存分析结果供可视化使用
        this.toothCountAnalysis = this.toothCount.toothCountAnalysis;
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
