/**
 * 齿轮参数计算器
 * 实现齿轮各种参数的计算，包括跨棒距等
 */

class GearCalculator {
    constructor() {
        this.PI = Math.PI;
    }

    /**
     * 计算分度圆直径
     * @param {number} module - 模数
     * @param {number} toothCount - 齿数
     * @returns {number} 分度圆直径
     */
    calculatePitchDiameter(module, toothCount) {
        return module * toothCount;
    }

    /**
     * 计算齿顶圆直径
     * @param {number} module - 模数
     * @param {number} toothCount - 齿数
     * @param {number} addendumCoeff - 齿顶高系数
     * @returns {number} 齿顶圆直径
     */
    calculateAddendumDiameter(module, toothCount, addendumCoeff) {
        const pitchDiameter = this.calculatePitchDiameter(module, toothCount);
        return pitchDiameter + 2 * module * addendumCoeff;
    }

    /**
     * 计算齿根圆直径
     * @param {number} module - 模数
     * @param {number} toothCount - 齿数
     * @param {number} addendumCoeff - 齿顶高系数
     * @param {number} dedendumCoeff - 齿根高系数
     * @returns {number} 齿根圆直径
     */
    calculateDedendumDiameter(module, toothCount, addendumCoeff, dedendumCoeff) {
        const pitchDiameter = this.calculatePitchDiameter(module, toothCount);
        return pitchDiameter - 2 * module * (addendumCoeff + dedendumCoeff);
    }

    /**
     * 计算基圆直径
     * @param {number} module - 模数
     * @param {number} toothCount - 齿数
     * @param {number} pressureAngle - 压力角（度）
     * @returns {number} 基圆直径
     */
    calculateBaseDiameter(module, toothCount, pressureAngle) {
        const pitchDiameter = this.calculatePitchDiameter(module, toothCount);
        const pressureAngleRad = (pressureAngle * this.PI) / 180;
        return pitchDiameter * Math.cos(pressureAngleRad);
    }

    /**
     * 计算齿距（周节）
     * @param {number} module - 模数
     * @returns {number} 齿距
     */
    calculateCircularPitch(module) {
        return this.PI * module;
    }

    /**
     * 计算分度圆齿厚
     * @param {number} module - 模数
     * @returns {number} 齿厚
     */
    calculateToothThickness(module) {
        return (this.PI * module) / 2;
    }

    /**
     * 计算齿顶高
     * @param {number} module - 模数
     * @param {number} addendumCoeff - 齿顶高系数
     * @returns {number} 齿顶高
     */
    calculateAddendum(module, addendumCoeff) {
        return module * addendumCoeff;
    }

    /**
     * 计算齿根高
     * @param {number} module - 模数
     * @param {number} addendumCoeff - 齿顶高系数
     * @param {number} dedendumCoeff - 齿根高系数
     * @returns {number} 齿根高
     */
    calculateDedendum(module, addendumCoeff, dedendumCoeff) {
        return module * (addendumCoeff + dedendumCoeff);
    }

    /**
     * 计算跨齿数（用于跨棒距测量）
     * @param {number} toothCount - 齿数
     * @param {number} pressureAngle - 压力角（度）
     * @returns {number} 跨齿数
     */
    calculateSpanTeeth(toothCount, pressureAngle) {
        const pressureAngleRad = (pressureAngle * this.PI) / 180;
        // 跨齿数的计算公式
        const spanTeeth = (toothCount * pressureAngleRad) / this.PI + 0.5;
        return Math.round(spanTeeth);
    }

    /**
     * 计算跨棒距（M值）
     * @param {number} module - 模数
     * @param {number} toothCount - 齿数
     * @param {number} pressureAngle - 压力角（度）
     * @param {number} ballDiameter - 测量球直径
     * @param {number} addendumCoeff - 齿顶高系数
     * @param {number} dedendumCoeff - 齿根高系数
     * @returns {Object} 包含跨棒距和相关参数的对象
     */
    calculateSpanMeasurement(module, toothCount, pressureAngle, ballDiameter, addendumCoeff, dedendumCoeff) {
        const pressureAngleRad = (pressureAngle * this.PI) / 180;
        const pitchDiameter = this.calculatePitchDiameter(module, toothCount);
        const baseDiameter = this.calculateBaseDiameter(module, toothCount, pressureAngle);
        const baseRadius = baseDiameter / 2;
        
        // 计算跨齿数
        const spanTeeth = this.calculateSpanTeeth(toothCount, pressureAngle);
        
        // 计算分度圆齿厚
        const toothThickness = this.calculateToothThickness(module);
        
        // 计算跨齿数对应的渐开线函数值
        // inv(αb) = inv(α) + s/d - π/z
        // 其中 s 是分度圆齿厚，d 是分度圆直径，z 是齿数
        const invAlpha = Math.tan(pressureAngleRad) - pressureAngleRad;
        const sOverD = toothThickness / pitchDiameter;
        const piOverZ = this.PI / toothCount;
        const invAlphaSpan = invAlpha + sOverD + (spanTeeth - 0.5) * piOverZ;
        
        // 使用牛顿迭代法求解测量球中心处的压力角 αb
        let alphaBall = pressureAngleRad + 0.1; // 初始值略大于压力角
        
        for (let i = 0; i < 30; i++) {
            const tanAlphaBall = Math.tan(alphaBall);
            const invAlphaBall = tanAlphaBall - alphaBall;
            const f = invAlphaBall - invAlphaSpan;
            const df = tanAlphaBall * tanAlphaBall; // d(inv(α))/dα = tan²(α)
            
            if (Math.abs(df) < 1e-10) break;
            
            const newAlphaBall = alphaBall - f / df;
            
            if (Math.abs(newAlphaBall - alphaBall) < 1e-10) {
                alphaBall = newAlphaBall;
                break;
            }
            
            // 确保角度在合理范围内
            if (newAlphaBall < pressureAngleRad) {
                alphaBall = pressureAngleRad + 0.01;
            } else if (newAlphaBall > Math.PI / 2) {
                alphaBall = Math.PI / 2 - 0.01;
            } else {
                alphaBall = newAlphaBall;
            }
        }
        
        // 计算测量球中心到基圆的距离
        const ballCenterRadius = baseRadius / Math.cos(alphaBall);
        
        // 计算跨棒距
        // M = db / cos(αb) + dp (对于偶数齿)
        // 对于跨齿测量，需要考虑跨齿数的角度
        const angleSpan = (spanTeeth - 0.5) * 2 * this.PI / toothCount;
        const spanMeasurement = 2 * ballCenterRadius * Math.cos(angleSpan / 2) + ballDiameter;
        
        // 计算测量球中心距（两球中心之间的距离）
        const ballCenterDistance = 2 * ballCenterRadius * Math.cos(angleSpan / 2);
        
        return {
            spanMeasurement: spanMeasurement,
            spanTeeth: spanTeeth,
            ballCenterDistance: ballCenterDistance,
            measurementPressureAngle: (alphaBall * 180) / this.PI
        };
    }

    /**
     * 从轮廓数据计算齿轮参数
     * @param {Array<{x: number, y: number}>} profilePoints - 轮廓点数组
     * @param {number} ballDiameter - 测量球直径
     * @returns {Object} 计算得到的参数
     */
    calculateFromProfile(profilePoints, ballDiameter) {
        if (!profilePoints || profilePoints.length < 3) {
            throw new Error('轮廓点数据不足');
        }

        // 计算轮廓的统计信息
        const xValues = profilePoints.map(p => p.x);
        const yValues = profilePoints.map(p => p.y);
        
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        
        // 估算直径（假设轮廓是圆形的一部分）
        const estimatedDiameter = Math.max(maxX - minX, maxY - minY) * 2;
        
        // 计算中心点
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // 计算半径
        const radii = profilePoints.map(p => {
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            return Math.sqrt(dx * dx + dy * dy);
        });
        
        const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
        const estimatedPitchDiameter = avgRadius * 2;
        
        return {
            estimatedDiameter: estimatedDiameter,
            estimatedPitchDiameter: estimatedPitchDiameter,
            center: { x: centerX, y: centerY },
            avgRadius: avgRadius
        };
    }

    /**
     * 计算所有齿轮参数
     * @param {Object} params - 输入参数
     * @returns {Object} 所有计算结果
     */
    calculateAll(params) {
        const {
            toothCount,
            module,
            pressureAngle,
            addendumCoeff,
            dedendumCoeff,
            ballDiameter
        } = params;

        // 基本参数计算
        const pitchDiameter = this.calculatePitchDiameter(module, toothCount);
        const addendumDiameter = this.calculateAddendumDiameter(module, toothCount, addendumCoeff);
        const dedendumDiameter = this.calculateDedendumDiameter(module, toothCount, addendumCoeff, dedendumCoeff);
        const baseDiameter = this.calculateBaseDiameter(module, toothCount, pressureAngle);
        const circularPitch = this.calculateCircularPitch(module);
        const toothThickness = this.calculateToothThickness(module);
        const addendum = this.calculateAddendum(module, addendumCoeff);
        const dedendum = this.calculateDedendum(module, addendumCoeff, dedendumCoeff);

        // 跨棒距计算
        const spanData = this.calculateSpanMeasurement(
            module, toothCount, pressureAngle, ballDiameter,
            addendumCoeff, dedendumCoeff
        );

        return {
            pitchDiameter: pitchDiameter,
            addendumDiameter: addendumDiameter,
            dedendumDiameter: dedendumDiameter,
            baseDiameter: baseDiameter,
            circularPitch: circularPitch,
            toothThickness: toothThickness,
            addendum: addendum,
            dedendum: dedendum,
            spanMeasurement: spanData.spanMeasurement,
            spanTeeth: spanData.spanTeeth,
            ballCenterDistance: spanData.ballCenterDistance,
            measurementPressureAngle: spanData.measurementPressureAngle
        };
    }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearCalculator;
}

