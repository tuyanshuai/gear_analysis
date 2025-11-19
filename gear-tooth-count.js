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
        
        // 综合多个结果，优先使用方法2（passline分割方法）
        const allCandidates = [toothCount1, toothCount2, toothCount3].filter(tc => tc > 0);
        const reasonableCandidates = allCandidates.filter(tc => tc > 0 && tc <= 500);
        
        console.log('齿数计算结果:', {
            method1: toothCount1,
            method2: toothCount2,  // passline分割方法
            method3: toothCount3,
            allCandidates: allCandidates,
            reasonableCandidates: reasonableCandidates
        });
        
        // 优先使用方法2（passline分割方法）的结果
        if (toothCount2 > 0 && toothCount2 <= 500) {
            this.toothCountAnalysis.final = toothCount2;
            console.log('优先使用方法2（passline分割）的结果:', toothCount2);
            return toothCount2;
        }
        
        if (reasonableCandidates.length === 0) {
            // 如果所有结果都不合理，尝试使用峰值检测作为备选
            const fallback = this.estimateToothCountByPeaks(
                polarData.map(p => p.r),
                polarData.map(p => p.theta)
            );
            if (fallback > 0 && fallback <= 500) {
                this.toothCountAnalysis.fallback = fallback;
                console.log('使用备选方法，齿数:', fallback);
                return fallback;
            }
            // 如果备选也不合理，使用最小的非零值
            const minCandidate = Math.min(...allCandidates.filter(tc => tc > 0));
            console.warn('所有结果都不合理，使用最小值:', minCandidate);
            this.toothCountAnalysis.final = minCandidate;
            return minCandidate;
        }
        
        // 如果方法2不可用，选择最接近100的值
        const targetTeeth = 100;
        let bestToothCount = reasonableCandidates[0];
        let minDiff = Math.abs(bestToothCount - targetTeeth);
        
        for (const tc of reasonableCandidates) {
            const diff = Math.abs(tc - targetTeeth);
            if (diff < minDiff) {
                minDiff = diff;
                bestToothCount = tc;
            }
        }
        
        // 如果最接近100的值在合理范围内（80-120），使用它
        if (minDiff <= 20) {
            this.toothCountAnalysis.final = bestToothCount;
            console.log('选择最接近100的值:', bestToothCount);
            return bestToothCount;
        }
        
        // 否则选择出现次数最多的值（在合理范围内）
        const counts = {};
        reasonableCandidates.forEach(tc => {
            counts[tc] = (counts[tc] || 0) + 1;
        });
        
        let maxCount = 0;
        bestToothCount = reasonableCandidates[0];
        for (const [tc, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                bestToothCount = parseInt(tc);
            }
        }
        
        this.toothCountAnalysis.final = bestToothCount;
        console.log('选择出现次数最多的值（合理范围内）:', bestToothCount);
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
     * 方法2: 基于passline分割数据，统计连续段数量
     * 简单直接：超过passline的连续段就是一个齿，统计有多少段就是多少齿
     */
    calculateToothCountByRadiusPeaks(polarData) {
        if (polarData.length < 10) return 0;
        
        const rValues = polarData.map(p => p.r);
        const thetas = polarData.map(p => p.theta);
        
        // 计算passline（半径平均值）
        const avgR = rValues.reduce((a, b) => a + b, 0) / rValues.length;
        const threshold = avgR; // passline：半径平均值
        
        console.log('passline分割方法参数:', {
            minR: Math.min(...rValues).toFixed(3),
            maxR: Math.max(...rValues).toFixed(3),
            avgR: avgR.toFixed(3),
            passline: threshold.toFixed(3),
            totalPoints: rValues.length
        });
        
        // 找到所有超过passline的连续段
        const segments = []; // 每个段是一个齿
        let currentSegment = null;
        
        for (let i = 0; i < rValues.length; i++) {
            const isAbovePassline = rValues[i] > threshold;
            
            if (isAbovePassline) {
                // 如果当前点超过passline
                if (currentSegment === null) {
                    // 开始新段
                    currentSegment = { start: i, end: i };
                } else {
                    // 继续当前段
                    currentSegment.end = i;
                }
            } else {
                // 如果当前点低于passline
                if (currentSegment !== null) {
                    // 结束当前段，保存它
                    segments.push(currentSegment);
                    currentSegment = null;
                }
            }
        }
        
        // 如果最后还有未结束的段，保存它
        if (currentSegment !== null) {
            segments.push(currentSegment);
        }
        
        console.log('检测到的连续段数量（超过passline）:', segments.length);
        
        // 保存峰值用于可视化（使用每个段的中间点作为峰值）
        const peaks = segments.map(seg => Math.floor((seg.start + seg.end) / 2));
        this.lastPeaks = peaks;
        
        // 保存平滑后的半径（用于可视化，这里用原始值）
        this.lastSmoothedR = rValues;
        
        if (segments.length < 2) {
            console.log('连续段数量不足，返回0');
            return 0;
        }
        
        // 计算角度范围
        let angleRange = thetas[thetas.length - 1] - thetas[0];
        if (angleRange < 0) angleRange += 2 * Math.PI;
        
        console.log('角度范围:', angleRange.toFixed(4), '弧度 (', (angleRange * 180 / Math.PI).toFixed(1), '度)');
        console.log('检测到的连续段数:', segments.length);
        
        // 统计齿数：根据角度范围和段数量计算
        let estimatedTeeth = 0;
        
        // 如果角度范围接近完整一圈（85%以上），直接使用段数
        if (angleRange >= 2 * Math.PI * 0.85) {
            estimatedTeeth = segments.length;
            console.log('完整一圈（≥85%），齿数 = 段数 =', estimatedTeeth);
        } else if (angleRange > 0) {
            // 部分角度，按比例计算
            estimatedTeeth = Math.round(segments.length * (2 * Math.PI / angleRange));
            console.log('部分角度，按比例计算: 段数', segments.length, '× (2π /', angleRange.toFixed(4), ') =', estimatedTeeth);
        }
        
        console.log('方法2（passline分割）最终齿数:', estimatedTeeth);
        return estimatedTeeth;
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
        // 对于100齿的齿轮，每个齿大约需要 polarData.length / 100 个点
        const expectedPointsPerTooth = polarData.length / 100;
        const minPeriod = Math.max(3, Math.floor(expectedPointsPerTooth * 0.3));
        const maxPeriod = Math.min(500, Math.floor(expectedPointsPerTooth * 3));
        
        let bestPeriod = 0;
        let maxCorrelation = 0;
        
        // 优先检查接近期望值的周期
        const preferredPeriods = [
            Math.floor(expectedPointsPerTooth * 0.8),
            Math.floor(expectedPointsPerTooth),
            Math.floor(expectedPointsPerTooth * 1.2)
        ].filter(p => p >= minPeriod && p <= maxPeriod);
        
        // 先检查期望的周期
        for (const period of preferredPeriods) {
            let correlation = 0;
            let count = 0;
            
            for (let i = 0; i < polarData.length - period; i++) {
                const diff = Math.abs(rValues[i] - rValues[i + period]);
                correlation += Math.exp(-diff / (stdDev * 2));
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
        
        // 如果期望周期相关性不够，搜索所有周期
        if (maxCorrelation < 0.3) {
            for (let period = minPeriod; period <= maxPeriod; period++) {
                if (preferredPeriods.includes(period)) continue; // 跳过已检查的
                
                let correlation = 0;
                let count = 0;
                
                for (let i = 0; i < polarData.length - period; i++) {
                    const diff = Math.abs(rValues[i] - rValues[i + period]);
                    correlation += Math.exp(-diff / (stdDev * 2));
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
        }
        
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

