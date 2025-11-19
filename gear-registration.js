/**
 * 配准模块
 * 提供ICP配准和轮廓误差计算功能
 */

class GearRegistration {
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
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearRegistration;
}

