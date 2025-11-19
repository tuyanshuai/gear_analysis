/**
 * 齿轮等级计算模块
 * 提供ISO、JIS、GB/T标准的齿轮等级计算
 */

class GearGrade {
    /**
     * 计算齿轮等级（ISO 1328标准）
     * @param {number} pitchDiameter - 分度圆直径 (mm)
     * @param {number} toothCount - 齿数
     * @param {number} singlePitchError - 单个齿距误差 (μm)
     * @param {number} cumulativePitchError - 累计齿距误差 (μm)
     * @param {number} profileError - 轮廓度误差 (μm)
     * @returns {string} ISO等级
     */
    calculateISOGrade(pitchDiameter, toothCount, singlePitchError, cumulativePitchError, profileError) {
        // ISO 1328标准等级表（简化版）
        // 实际标准更复杂，这里提供基本实现
        const module = pitchDiameter / (toothCount || 20);
        
        // ISO等级范围：0-12，数字越小精度越高
        // 基于分度圆直径和模数查找允许值
        let grade = 12;
        
        // 简化的等级判定（实际需要查表）
        if (module <= 1) {
            if (singlePitchError <= 2 && cumulativePitchError <= 4 && profileError <= 2) grade = 3;
            else if (singlePitchError <= 4 && cumulativePitchError <= 8 && profileError <= 4) grade = 4;
            else if (singlePitchError <= 8 && cumulativePitchError <= 16 && profileError <= 8) grade = 5;
            else if (singlePitchError <= 16 && cumulativePitchError <= 32 && profileError <= 16) grade = 6;
            else if (singlePitchError <= 32 && cumulativePitchError <= 64 && profileError <= 32) grade = 7;
            else grade = 8;
        } else if (module <= 3) {
            if (singlePitchError <= 3 && cumulativePitchError <= 6 && profileError <= 3) grade = 3;
            else if (singlePitchError <= 6 && cumulativePitchError <= 12 && profileError <= 6) grade = 4;
            else if (singlePitchError <= 12 && cumulativePitchError <= 24 && profileError <= 12) grade = 5;
            else if (singlePitchError <= 24 && cumulativePitchError <= 48 && profileError <= 24) grade = 6;
            else if (singlePitchError <= 48 && cumulativePitchError <= 96 && profileError <= 48) grade = 7;
            else grade = 8;
        } else {
            if (singlePitchError <= 5 && cumulativePitchError <= 10 && profileError <= 5) grade = 3;
            else if (singlePitchError <= 10 && cumulativePitchError <= 20 && profileError <= 10) grade = 4;
            else if (singlePitchError <= 20 && cumulativePitchError <= 40 && profileError <= 20) grade = 5;
            else if (singlePitchError <= 40 && cumulativePitchError <= 80 && profileError <= 40) grade = 6;
            else if (singlePitchError <= 80 && cumulativePitchError <= 160 && profileError <= 80) grade = 7;
            else grade = 8;
        }

        return `ISO ${grade}`;
    }

    /**
     * 计算齿轮等级（JIS B 1702标准）
     * @param {number} pitchDiameter - 分度圆直径 (mm)
     * @param {number} toothCount - 齿数
     * @param {number} singlePitchError - 单个齿距误差 (μm)
     * @param {number} cumulativePitchError - 累计齿距误差 (μm)
     * @param {number} profileError - 轮廓度误差 (μm)
     * @returns {string} JIS等级
     */
    calculateJISGrade(pitchDiameter, toothCount, singlePitchError, cumulativePitchError, profileError) {
        // JIS B 1702标准等级：0-8级，数字越小精度越高
        const module = pitchDiameter / (toothCount || 20);
        let grade = 8;

        if (module <= 1) {
            if (singlePitchError <= 2.5 && cumulativePitchError <= 5 && profileError <= 2.5) grade = 0;
            else if (singlePitchError <= 4 && cumulativePitchError <= 8 && profileError <= 4) grade = 1;
            else if (singlePitchError <= 6 && cumulativePitchError <= 12 && profileError <= 6) grade = 2;
            else if (singlePitchError <= 10 && cumulativePitchError <= 20 && profileError <= 10) grade = 3;
            else if (singlePitchError <= 16 && cumulativePitchError <= 32 && profileError <= 16) grade = 4;
            else grade = 5;
        } else if (module <= 3) {
            if (singlePitchError <= 3 && cumulativePitchError <= 6 && profileError <= 3) grade = 0;
            else if (singlePitchError <= 5 && cumulativePitchError <= 10 && profileError <= 5) grade = 1;
            else if (singlePitchError <= 8 && cumulativePitchError <= 16 && profileError <= 8) grade = 2;
            else if (singlePitchError <= 12 && cumulativePitchError <= 24 && profileError <= 12) grade = 3;
            else if (singlePitchError <= 20 && cumulativePitchError <= 40 && profileError <= 20) grade = 4;
            else grade = 5;
        } else {
            if (singlePitchError <= 4 && cumulativePitchError <= 8 && profileError <= 4) grade = 0;
            else if (singlePitchError <= 6 && cumulativePitchError <= 12 && profileError <= 6) grade = 1;
            else if (singlePitchError <= 10 && cumulativePitchError <= 20 && profileError <= 10) grade = 2;
            else if (singlePitchError <= 16 && cumulativePitchError <= 32 && profileError <= 16) grade = 3;
            else if (singlePitchError <= 25 && cumulativePitchError <= 50 && profileError <= 25) grade = 4;
            else grade = 5;
        }

        return `JIS ${grade}`;
    }

    /**
     * 计算齿轮等级（GB/T 10095标准，GBK）
     * @param {number} pitchDiameter - 分度圆直径 (mm)
     * @param {number} toothCount - 齿数
     * @param {number} singlePitchError - 单个齿距误差 (μm)
     * @param {number} cumulativePitchError - 累计齿距误差 (μm)
     * @param {number} profileError - 轮廓度误差 (μm)
     * @returns {string} GBK等级
     */
    calculateGBKGrade(pitchDiameter, toothCount, singlePitchError, cumulativePitchError, profileError) {
        // GB/T 10095标准等级：0-12级，数字越小精度越高
        const module = pitchDiameter / (toothCount || 20);
        let grade = 12;

        if (module <= 1) {
            if (singlePitchError <= 2 && cumulativePitchError <= 4 && profileError <= 2) grade = 3;
            else if (singlePitchError <= 4 && cumulativePitchError <= 8 && profileError <= 4) grade = 4;
            else if (singlePitchError <= 8 && cumulativePitchError <= 16 && profileError <= 8) grade = 5;
            else if (singlePitchError <= 16 && cumulativePitchError <= 32 && profileError <= 16) grade = 6;
            else if (singlePitchError <= 32 && cumulativePitchError <= 64 && profileError <= 32) grade = 7;
            else if (singlePitchError <= 64 && cumulativePitchError <= 128 && profileError <= 64) grade = 8;
            else grade = 9;
        } else if (module <= 3) {
            if (singlePitchError <= 3 && cumulativePitchError <= 6 && profileError <= 3) grade = 3;
            else if (singlePitchError <= 6 && cumulativePitchError <= 12 && profileError <= 6) grade = 4;
            else if (singlePitchError <= 12 && cumulativePitchError <= 24 && profileError <= 12) grade = 5;
            else if (singlePitchError <= 24 && cumulativePitchError <= 48 && profileError <= 24) grade = 6;
            else if (singlePitchError <= 48 && cumulativePitchError <= 96 && profileError <= 48) grade = 7;
            else if (singlePitchError <= 96 && cumulativePitchError <= 192 && profileError <= 96) grade = 8;
            else grade = 9;
        } else {
            if (singlePitchError <= 5 && cumulativePitchError <= 10 && profileError <= 5) grade = 3;
            else if (singlePitchError <= 10 && cumulativePitchError <= 20 && profileError <= 10) grade = 4;
            else if (singlePitchError <= 20 && cumulativePitchError <= 40 && profileError <= 20) grade = 5;
            else if (singlePitchError <= 40 && cumulativePitchError <= 80 && profileError <= 40) grade = 6;
            else if (singlePitchError <= 80 && cumulativePitchError <= 160 && profileError <= 80) grade = 7;
            else if (singlePitchError <= 160 && cumulativePitchError <= 320 && profileError <= 160) grade = 8;
            else grade = 9;
        }

        return `GB/T ${grade}`;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearGrade;
}

