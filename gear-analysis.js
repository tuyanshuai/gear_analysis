/**
 * 齿轮分析模块
 * 包含FFT分析、圆拟合、误差计算、配准等功能
 */

class GearAnalysis {
    constructor() {
        this.profilePoints = [];
        this.cadPoints = [];
        this.toothCount = 0;
        this.addendumRadius = 0;
        this.dedendumRadius = 0;
        this.registrationTransform = null;
    }

    /**
     * 解析轮廓文件（TXT/CSV）
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     * @returns {Array<{x: number, y: number}>} 轮廓点数组
     */
    parseProfileFile(content, filename) {
        const points = [];
        const lines = content.split(/\r?\n/);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) continue;

            // 支持CSV格式（带或不带表头）
            if (i === 0 && (line.toLowerCase().includes('x') || line.toLowerCase().includes('y'))) {
                continue; // 跳过表头
            }

            // 支持多种分隔符：逗号、空格、制表符
            const parts = line.split(/[,\s\t]+/).filter(p => p.trim());
            
            if (parts.length >= 2) {
                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                if (!isNaN(x) && !isNaN(y)) {
                    points.push({ x, y });
                }
            }
        }

        return points;
    }

    /**
     * 解析DXF文件（简化版，仅提取LINE和ARC实体）
     * @param {string} content - DXF文件内容
     * @returns {Array<{x: number, y: number}>} CAD轮廓点数组
     */
    parseDXFFile(content) {
        const points = [];
        const lines = content.split(/\r?\n/);
        
        // 简化的DXF解析，查找LINE和ARC实体
        let inEntity = false;
        let entityType = '';
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
        let centerX = 0, centerY = 0, radius = 0, startAngle = 0, endAngle = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';

            if (line === '0' && (nextLine === 'LINE' || nextLine === 'ARC' || nextLine === 'CIRCLE')) {
                entityType = nextLine;
                inEntity = true;
                i++;
                continue;
            }

            if (inEntity) {
                if (line === '10') x1 = parseFloat(nextLine) || 0;
                else if (line === '20') y1 = parseFloat(nextLine) || 0;
                else if (line === '11') x2 = parseFloat(nextLine) || 0;
                else if (line === '21') y2 = parseFloat(nextLine) || 0;
                else if (line === '40') radius = parseFloat(nextLine) || 0;
                else if (line === '50') startAngle = parseFloat(nextLine) || 0;
                else if (line === '51') endAngle = parseFloat(nextLine) || 0;
                else if (line === '0') {
                    // 实体结束，处理数据
                    if (entityType === 'LINE') {
                        points.push({ x: x1, y: y1 });
                        points.push({ x: x2, y: y2 });
                    } else if (entityType === 'ARC' || entityType === 'CIRCLE') {
                        // 将圆弧离散为点
                        const centerX = x1;
                        const centerY = y1;
                        const start = entityType === 'CIRCLE' ? 0 : (startAngle * Math.PI / 180);
                        const end = entityType === 'CIRCLE' ? 2 * Math.PI : (endAngle * Math.PI / 180);
                        const steps = Math.max(10, Math.ceil(Math.abs(end - start) * radius / 0.1));
                        
                        for (let j = 0; j <= steps; j++) {
                            const angle = start + (end - start) * (j / steps);
                            points.push({
                                x: centerX + radius * Math.cos(angle),
                                y: centerY + radius * Math.sin(angle)
                            });
                        }
                    }
                    inEntity = false;
                    entityType = '';
                }
            }
        }

        return points;
    }

    /**
     * 计算极坐标 r(theta)
     * @param {Array<{x: number, y: number}>} points - 轮廓点
     * @returns {Array<{r: number, theta: number}>} 极坐标数组
     */
    calculatePolarCoordinates(points) {
        // 计算中心点
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        // 转换为极坐标
        const polar = points.map(p => {
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            const r = Math.sqrt(dx * dx + dy * dy);
            const theta = Math.atan2(dy, dx);
            return { r, theta, centerX, centerY };
        });

        // 按角度排序
        polar.sort((a, b) => a.theta - b.theta);

        return polar;
    }

    /**
     * FFT分析计算齿数
     * @param {Array<{r: number, theta: number}>} polarData - 极坐标数据
     * @returns {number} 齿数
     */
    calculateToothCountByFFT(polarData) {
        if (polarData.length < 2) return 0;

        // 提取半径序列
        const rValues = polarData.map(p => p.r);
        const n = rValues.length;

        // 简单的FFT实现（使用DFT）
        const frequencies = [];
        const maxFreq = Math.min(100, Math.floor(n / 2));

        for (let k = 0; k < maxFreq; k++) {
            let real = 0;
            let imag = 0;

            for (let j = 0; j < n; j++) {
                const angle = -2 * Math.PI * k * j / n;
                real += rValues[j] * Math.cos(angle);
                imag += rValues[j] * Math.sin(angle);
            }

            const magnitude = Math.sqrt(real * real + imag * imag);
            frequencies.push({ k, magnitude });
        }

        // 找到最大幅值对应的频率（排除DC分量）
        frequencies.sort((a, b) => b.magnitude - a.magnitude);
        
        // 齿数应该是最大幅值对应的频率
        let toothCount = 0;
        for (let i = 1; i < frequencies.length; i++) {
            const freq = frequencies[i].k;
            if (freq > 5 && freq < 200) { // 合理的齿数范围
                toothCount = freq;
                break;
            }
        }

        return Math.round(toothCount);
    }

    /**
     * 拟合圆（最小二乘法）
     * @param {Array<{x: number, y: number}>} points - 点集
     * @returns {{centerX: number, centerY: number, radius: number}} 拟合圆参数
     */
    fitCircle(points) {
        if (points.length < 3) return null;

        let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
        let sumX3 = 0, sumY3 = 0, sumXY2 = 0, sumX2Y = 0;

        for (const p of points) {
            const x = p.x;
            const y = p.y;
            const x2 = x * x;
            const y2 = y * y;

            sumX += x;
            sumY += y;
            sumX2 += x2;
            sumY2 += y2;
            sumXY += x * y;
            sumX3 += x2 * x;
            sumY3 += y2 * y;
            sumXY2 += x * y2;
            sumX2Y += x2 * y;
        }

        const n = points.length;
        const C = n * sumX2 - sumX * sumX;
        const D = n * sumXY - sumX * sumY;
        const E = n * sumX3 + n * sumXY2 - (sumX2 + sumY2) * sumX;
        const G = n * sumY2 - sumY * sumY;
        const H = n * sumX2Y + n * sumY3 - (sumX2 + sumY2) * sumY;

        const denominator = C * G - D * D;
        if (Math.abs(denominator) < 1e-10) return null;

        const centerX = (H * D - E * G) / denominator;
        const centerY = (H * C - E * D) / (-denominator);

        let sumR = 0;
        for (const p of points) {
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            sumR += Math.sqrt(dx * dx + dy * dy);
        }
        const radius = sumR / n;

        return { centerX, centerY, radius };
    }

    /**
     * 拟合齿顶圆和齿根圆
     * @param {Array<{x: number, y: number}>} points - 轮廓点
     * @param {number} toothCount - 齿数
     * @returns {{addendumRadius: number, dedendumRadius: number}} 拟合结果
     */
    fitAddendumAndDedendumCircles(points, toothCount) {
        if (points.length < 3 || toothCount < 1) return null;

        // 计算中心点
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        // 计算每个点到中心的距离
        const distances = points.map(p => {
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            return Math.sqrt(dx * dx + dy * dy);
        });

        // 按距离排序，找到局部最大值（齿顶）和局部最小值（齿根）
        const sortedIndices = distances.map((d, i) => ({ d, i }))
            .sort((a, b) => a.d - b.d);

        // 使用分位数方法：上25%作为齿顶圆，下25%作为齿根圆
        const sortedDistances = sortedIndices.map(item => item.d);
        const q75 = sortedDistances[Math.floor(sortedDistances.length * 0.75)];
        const q25 = sortedDistances[Math.floor(sortedDistances.length * 0.25)];

        // 提取齿顶和齿根区域的点进行拟合
        const addendumPoints = points.filter((p, i) => distances[i] >= q75);
        const dedendumPoints = points.filter((p, i) => distances[i] <= q25);

        const addendumCircle = this.fitCircle(addendumPoints);
        const dedendumCircle = this.fitCircle(dedendumPoints);

        return {
            addendumRadius: addendumCircle ? addendumCircle.radius : q75,
            dedendumRadius: dedendumCircle ? dedendumCircle.radius : q25,
            centerX,
            centerY
        };
    }

    /**
     * 计算点到线段的最近距离
     * @param {{x: number, y: number}} point - 点
     * @param {{x: number, y: number}} lineStart - 线段起点
     * @param {{x: number, y: number}} lineEnd - 线段终点
     * @returns {number} 最近距离
     */
    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 计算点到轮廓的最近距离
     * @param {{x: number, y: number}} point - 点
     * @param {Array<{x: number, y: number}>} contour - 轮廓点数组
     * @returns {number} 最近距离
     */
    pointToContourDistance(point, contour) {
        if (contour.length < 2) return Infinity;

        let minDist = Infinity;
        for (let i = 0; i < contour.length - 1; i++) {
            const dist = this.pointToLineDistance(point, contour[i], contour[i + 1]);
            minDist = Math.min(minDist, dist);
        }

        // 闭合轮廓
        if (contour.length > 2) {
            const dist = this.pointToLineDistance(point, contour[contour.length - 1], contour[0]);
            minDist = Math.min(minDist, dist);
        }

        return minDist;
    }

    /**
     * ICP配准算法（迭代最近点）
     * @param {Array<{x: number, y: number}>} sourcePoints - 源点集（测量点）
     * @param {Array<{x: number, y: number}>} targetPoints - 目标点集（CAD轮廓）
     * @param {number} maxIterations - 最大迭代次数
     * @returns {{transform: {tx: number, ty: number, angle: number, scale: number}, error: number}} 配准结果
     */
    icpRegistration(sourcePoints, targetPoints, maxIterations = 50) {
        if (sourcePoints.length < 3 || targetPoints.length < 3) {
            return { transform: { tx: 0, ty: 0, angle: 0, scale: 1 }, error: Infinity };
        }

        // 初始变换：仅平移（将中心对齐）
        const sourceCenter = {
            x: sourcePoints.reduce((s, p) => s + p.x, 0) / sourcePoints.length,
            y: sourcePoints.reduce((s, p) => s + p.y, 0) / sourcePoints.length
        };
        const targetCenter = {
            x: targetPoints.reduce((s, p) => s + p.x, 0) / targetPoints.length,
            y: targetPoints.reduce((s, p) => s + p.y, 0) / targetPoints.length
        };

        let tx = targetCenter.x - sourceCenter.x;
        let ty = targetCenter.y - sourceCenter.y;
        let angle = 0;
        let scale = 1;

        const minError = 1e-6;
        let prevError = Infinity;

        for (let iter = 0; iter < maxIterations; iter++) {
            // 应用当前变换
            const transformed = sourcePoints.map(p => {
                const x = p.x - sourceCenter.x;
                const y = p.y - sourceCenter.y;
                const xr = x * Math.cos(angle) - y * Math.sin(angle);
                const yr = x * Math.sin(angle) + y * Math.cos(angle);
                return {
                    x: xr * scale + targetCenter.x + tx,
                    y: yr * scale + targetCenter.y + ty
                };
            });

            // 计算总误差
            let totalError = 0;
            for (const p of transformed) {
                const dist = this.pointToContourDistance(p, targetPoints);
                totalError += dist * dist;
            }
            totalError = Math.sqrt(totalError / transformed.length);

            if (Math.abs(prevError - totalError) < minError) break;
            prevError = totalError;

            // 简化版ICP：仅优化平移（完整ICP需要更复杂的优化）
            // 这里使用梯度下降法优化平移
            const stepSize = 0.1;
            let bestTx = tx, bestTy = ty;
            let bestError = totalError;

            // 尝试小幅调整平移
            for (const dx of [-stepSize, 0, stepSize]) {
                for (const dy of [-stepSize, 0, stepSize]) {
                    const testTx = tx + dx;
                    const testTy = ty + dy;
                    const testTransformed = sourcePoints.map(p => {
                        const x = p.x - sourceCenter.x;
                        const y = p.y - sourceCenter.y;
                        const xr = x * Math.cos(angle) - y * Math.sin(angle);
                        const yr = x * Math.sin(angle) + y * Math.cos(angle);
                        return {
                            x: xr * scale + targetCenter.x + testTx,
                            y: yr * scale + targetCenter.y + testTy
                        };
                    });

                    let testError = 0;
                    for (const p of testTransformed) {
                        const dist = this.pointToContourDistance(p, targetPoints);
                        testError += dist * dist;
                    }
                    testError = Math.sqrt(testError / testTransformed.length);

                    if (testError < bestError) {
                        bestError = testError;
                        bestTx = testTx;
                        bestTy = testTy;
                    }
                }
            }

            tx = bestTx;
            ty = bestTy;
        }

        return {
            transform: { tx, ty, angle, scale },
            error: prevError
        };
    }

    /**
     * 计算轮廓度误差（点到轮廓最近距离的最大值）
     * @param {Array<{x: number, y: number}>} measuredPoints - 测量点
     * @param {Array<{x: number, y: number}>} cadContour - CAD轮廓
     * @param {Object} transform - 配准变换
     * @returns {number} 轮廓度误差（μm）
     */
    calculateProfileError(measuredPoints, cadContour, transform) {
        if (measuredPoints.length === 0 || cadContour.length < 2) return 0;

        const sourceCenter = {
            x: measuredPoints.reduce((s, p) => s + p.x, 0) / measuredPoints.length,
            y: measuredPoints.reduce((s, p) => s + p.y, 0) / measuredPoints.length
        };

        let maxError = 0;

        for (const p of measuredPoints) {
            // 应用变换
            const x = p.x - sourceCenter.x;
            const y = p.y - sourceCenter.y;
            const xr = x * Math.cos(transform.angle) - y * Math.sin(transform.angle);
            const yr = x * Math.sin(transform.angle) + y * Math.cos(transform.angle);
            const transformed = {
                x: xr * transform.scale + sourceCenter.x + transform.tx,
                y: yr * transform.scale + sourceCenter.y + transform.ty
            };

            // 计算到CAD轮廓的最近距离
            const dist = this.pointToContourDistance(transformed, cadContour);
            maxError = Math.max(maxError, dist);
        }

        // 转换为微米
        return maxError * 1000;
    }

    /**
     * 计算齿轮等级（ISO 1328标准）
     * @param {number} pitchDiameter - 分度圆直径 (mm)
     * @param {number} singlePitchError - 单个齿距误差 (μm)
     * @param {number} cumulativePitchError - 累计齿距误差 (μm)
     * @param {number} profileError - 轮廓度误差 (μm)
     * @returns {string} ISO等级
     */
    calculateISOGrade(pitchDiameter, singlePitchError, cumulativePitchError, profileError) {
        // ISO 1328标准等级表（简化版）
        // 实际标准更复杂，这里提供基本实现
        const module = pitchDiameter / (this.toothCount || 20);
        
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
     * @param {number} singlePitchError - 单个齿距误差 (μm)
     * @param {number} cumulativePitchError - 累计齿距误差 (μm)
     * @param {number} profileError - 轮廓度误差 (μm)
     * @returns {string} JIS等级
     */
    calculateJISGrade(pitchDiameter, singlePitchError, cumulativePitchError, profileError) {
        // JIS B 1702标准等级：0-8级，数字越小精度越高
        const module = pitchDiameter / (this.toothCount || 20);
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
     * @param {number} singlePitchError - 单个齿距误差 (μm)
     * @param {number} cumulativePitchError - 累计齿距误差 (μm)
     * @param {number} profileError - 轮廓度误差 (μm)
     * @returns {string} GBK等级
     */
    calculateGBKGrade(pitchDiameter, singlePitchError, cumulativePitchError, profileError) {
        // GB/T 10095标准等级：0-12级，数字越小精度越高
        const module = pitchDiameter / (this.toothCount || 20);
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
    module.exports = GearAnalysis;
}

