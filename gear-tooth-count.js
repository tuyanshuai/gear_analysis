/**
 * 齿数计算模块
 * 基于轮廓点云计算齿轮齿数
 */

class GearToothCount {
    constructor() {
        this.lastAngleDiffs = [];
        this.lastPeaks = [];
        this.lastSmoothedR = [];
    }

    /**
     * 基于轮廓点云计算齿数（主要方法）
     * 使用角度差分、半径变化和峰值检测等多种方法
     * @param {Array<{r: number, theta: number}>} polarData - 极坐标数据
     * @returns {number} 齿数
     */
    calculateToothCountFromProfile(polarData) {
        if (polarData.length < 10) return 0;

        // 方法1: 角度差分分析 - 检测齿槽位置
        const toothCount1 = this.calculateToothCountByAngleDiff(polarData);
        
        // 方法2: 半径变化峰值检测 - 检测齿顶数量
        const toothCount2 = this.calculateToothCountByRadiusPeaks(polarData);
        
        // 方法3: 半径变化周期性分析
        const toothCount3 = this.calculateToothCountByPeriodicity(polarData);
        
        // 保存中间结果用于可视化
        this.toothCountAnalysis = {
            method1: toothCount1,
            method2: toothCount2,
            method3: toothCount3,
            polarData: polarData,
            angleDiffs: this.lastAngleDiffs || [],
            peaks: this.lastPeaks || [],
            smoothedR: this.lastSmoothedR || []
        };
        
        // 综合多个结果，不过滤（显示所有结果）
        const candidates = [toothCount1, toothCount2, toothCount3].filter(tc => tc > 0);
        
        if (candidates.length === 0) {
            // 如果都失败，使用峰值检测作为备选
            const fallback = this.estimateToothCountByPeaks(
                polarData.map(p => p.r),
                polarData.map(p => p.theta)
            );
            this.toothCountAnalysis.fallback = fallback;
            return fallback;
        }
        
        // 选择出现次数最多的值
        const counts = {};
        candidates.forEach(tc => {
            counts[tc] = (counts[tc] || 0) + 1;
        });
        
        let maxCount = 0;
        let bestToothCount = candidates[0];
        for (const [tc, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                bestToothCount = parseInt(tc);
            }
        }
        
        this.toothCountAnalysis.final = bestToothCount;
        return bestToothCount;
    }

    /**
     * 方法1: 通过角度差分分析计算齿数
     * 计算相邻点的角度差，齿槽位置会有较大的角度跳跃
     */
    calculateToothCountByAngleDiff(polarData) {
        if (polarData.length < 10) return 0;
        
        // 计算角度差分
        const angleDiffs = [];
        for (let i = 1; i < polarData.length; i++) {
            let diff = polarData[i].theta - polarData[i - 1].theta;
            // 处理角度跨越
            if (diff < 0) diff += 2 * Math.PI;
            if (diff > Math.PI) diff = 2 * Math.PI - diff; // 处理反向
            angleDiffs.push(diff);
        }
        
        // 计算平均角度差
        const avgDiff = angleDiffs.reduce((a, b) => a + b, 0) / angleDiffs.length;
        
        // 保存角度差用于可视化
        this.lastAngleDiffs = angleDiffs;
        
        // 找到显著大于平均值的角度差（可能是齿槽）
        // 对于齿数较多的齿轮，角度差会更小，需要调整阈值
        const stdDev = Math.sqrt(angleDiffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / angleDiffs.length);
        const threshold = avgDiff + stdDev * 2; // 使用标准差而不是固定倍数
        const largeDiffs = angleDiffs.filter(d => d > threshold);
        
        // 计算角度范围
        let angleRange = polarData[polarData.length - 1].theta - polarData[0].theta;
        if (angleRange < 0) {
            const lastAngle = polarData[polarData.length - 1].theta;
            const firstAngle = polarData[0].theta;
            const wrappedRange = (2 * Math.PI - firstAngle) + lastAngle;
            angleRange = Math.max(angleRange + 2 * Math.PI, wrappedRange);
        }
        
        // 估算齿数
        if (angleRange >= 2 * Math.PI * 0.9) {
            // 完整一圈
            return largeDiffs.length;
        } else if (angleRange > 0) {
            // 部分角度，按比例计算
            return Math.round(largeDiffs.length * (2 * Math.PI / angleRange));
        }
        
        return 0;
    }

    /**
     * 方法2: 通过半径峰值检测计算齿数
     * 齿顶对应半径的局部最大值
     */
    calculateToothCountByRadiusPeaks(polarData) {
        if (polarData.length < 10) return 0;
        
        const rValues = polarData.map(p => p.r);
        const thetas = polarData.map(p => p.theta);
        
        // 平滑处理（移动平均）
        // 对于100齿的齿轮，每个齿的点数较少，使用较小的窗口
        const estimatedToothCount = Math.floor(polarData.length / 20); // 粗略估计
        const windowSize = estimatedToothCount > 50 
            ? Math.max(2, Math.floor(polarData.length / 200))  // 齿数多时用更小窗口
            : Math.max(3, Math.floor(polarData.length / 100)); // 齿数少时用较大窗口
        const smoothedR = [];
        for (let i = 0; i < rValues.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = Math.max(0, i - windowSize); j <= Math.min(rValues.length - 1, i + windowSize); j++) {
                sum += rValues[j];
                count++;
            }
            smoothedR.push(sum / count);
        }
        
        // 保存平滑后的半径用于可视化
        this.lastSmoothedR = smoothedR;
        
        // 找到局部最大值（齿顶）
        const peaks = [];
        const rRange = Math.max(...rValues) - Math.min(...rValues);
        const avgR = rValues.reduce((a, b) => a + b, 0) / rValues.length;
        // 对于齿数多的齿轮，阈值应该更低，使用平均值而不是最小值+40%
        const threshold = avgR - rRange * 0.1; // 阈值：平均值 - 10%的范围
        
        // 使用更宽松的峰值检测条件，适应齿数多的齿轮
        // 对于齿数多的齿轮，降低阈值要求（从5%降到2%）
        const minPeakHeight = estimatedToothCount > 50 ? rRange * 0.02 : rRange * 0.05;
        
        for (let i = 3; i < smoothedR.length - 3; i++) {
            // 检查是否是局部最大值（检查前后更多点）
            const isLocalMax = smoothedR[i] > smoothedR[i - 1] && 
                               smoothedR[i] > smoothedR[i + 1] &&
                               smoothedR[i] > smoothedR[i - 2] &&
                               smoothedR[i] > smoothedR[i + 2];
            
            // 对于齿数多的齿轮，峰值可能更接近平均值，降低阈值要求
            if (isLocalMax && smoothedR[i] > threshold) {
                // 确保这个峰值足够突出（比周围点明显高）
                const localAvg = (smoothedR[i - 2] + smoothedR[i - 1] + smoothedR[i + 1] + smoothedR[i + 2]) / 4;
                if (smoothedR[i] > localAvg + minPeakHeight) {
                    peaks.push(i);
                }
            }
        }
        
        // 保存峰值用于可视化
        this.lastPeaks = peaks;
        
        if (peaks.length < 2) return 0;
        
        // 计算角度范围
        let angleRange = thetas[thetas.length - 1] - thetas[0];
        if (angleRange < 0) angleRange += 2 * Math.PI;
        
        // 估算齿数
        if (angleRange >= 2 * Math.PI * 0.9) {
            return peaks.length;
        } else if (angleRange > 0) {
            return Math.round(peaks.length * (2 * Math.PI / angleRange));
        }
        
        return 0;
    }

    /**
     * 方法3: 通过周期性分析计算齿数
     * 分析半径变化的周期性
     */
    calculateToothCountByPeriodicity(polarData) {
        if (polarData.length < 20) return 0;
        
        const rValues = polarData.map(p => p.r);
        const thetas = polarData.map(p => p.theta);
        
        // 计算角度范围
        let angleRange = thetas[thetas.length - 1] - thetas[0];
        if (angleRange < 0) angleRange += 2 * Math.PI;
        
        // 如果角度范围太小，无法准确计算
        if (angleRange < Math.PI / 2) return 0;
        
        // 计算半径的标准差（用于衡量变化程度）
        const avgR = rValues.reduce((a, b) => a + b, 0) / rValues.length;
        const variance = rValues.reduce((sum, r) => sum + Math.pow(r - avgR, 2), 0) / rValues.length;
        const stdDev = Math.sqrt(variance);
        
        // 如果变化太小，可能不是齿轮轮廓
        if (stdDev < avgR * 0.01) return 0;
        
        // 计算半径变化的自相关，寻找周期性
        // 简化方法：计算不同周期长度的相关性
        // 对于100齿的齿轮，每个齿大约需要 polarData.length / 100 个点
        const estimatedPointsPerTooth = Math.floor(polarData.length / 100);
        const minPeriod = Math.max(3, Math.floor(estimatedPointsPerTooth * 0.5));
        const maxPeriod = Math.min(200, Math.floor(polarData.length / 3));
        
        let bestPeriod = 0;
        let maxCorrelation = 0;
        
        for (let period = minPeriod; period <= maxPeriod; period++) {
            let correlation = 0;
            let count = 0;
            
            // 使用更精确的相关性计算
            for (let i = 0; i < polarData.length - period; i++) {
                const diff = Math.abs(rValues[i] - rValues[i + period]);
                // 使用归一化的相关性，考虑标准差
                correlation += Math.exp(-diff / (stdDev * 2)); // 使用指数衰减
                count++;
            }
            
            if (count > 0) {
                correlation /= count;
                if (correlation > maxCorrelation) {
                    maxCorrelation = correlation;
                    bestPeriod = period;
                }
            }
        }
        
        // 降低相关性阈值，适应齿数多的齿轮
        if (bestPeriod === 0 || maxCorrelation < 0.2) return 0;
        
        // 根据周期估算齿数
        const pointsPerTooth = bestPeriod;
        const totalPoints = polarData.length;
        const estimatedTeeth = totalPoints / pointsPerTooth;
        
        // 根据角度范围调整
        if (angleRange >= 2 * Math.PI * 0.9) {
            return Math.round(estimatedTeeth);
        } else if (angleRange > 0) {
            return Math.round(estimatedTeeth * (2 * Math.PI / angleRange));
        }
        
        return 0;
    }

    /**
     * 通过检测r(theta)的峰值数量来估算齿数
     * @param {Array<number>} rValues - 半径值数组
     * @param {Array<number>} thetas - 角度数组
     * @returns {number} 估算的齿数
     */
    estimateToothCountByPeaks(rValues, thetas) {
        if (rValues.length < 10) return 0;
        
        // 找到局部最大值（齿顶）
        const peaks = [];
        const threshold = (Math.max(...rValues) - Math.min(...rValues)) * 0.3;
        
        for (let i = 1; i < rValues.length - 1; i++) {
            if (rValues[i] > rValues[i - 1] && rValues[i] > rValues[i + 1] && 
                rValues[i] > Math.min(...rValues) + threshold) {
                peaks.push(i);
            }
        }
        
        if (peaks.length < 2) return 0;
        
        // 计算角度范围
        const angleRange = thetas[thetas.length - 1] - thetas[0];
        const avgPeakDistance = angleRange / peaks.length;
        
        // 估算齿数：如果覆盖完整一圈，齿数就是峰值数
        // 否则按比例计算
        if (angleRange >= 2 * Math.PI * 0.9) {
            return peaks.length;
        } else {
            return Math.round(peaks.length * (2 * Math.PI / angleRange));
        }
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearToothCount;
}

