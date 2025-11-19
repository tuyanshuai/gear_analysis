/**
 * 圆拟合模块
 * 提供圆拟合和齿顶圆、齿根圆拟合功能
 */

class GearCircleFitting {
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
     * 齿顶圆 = 最大半径，齿根圆 = 最小半径
     * @param {Array<{x: number, y: number}>} points - 轮廓点
     * @param {number} toothCount - 齿数（未使用，保留兼容性）
     * @returns {{addendumRadius: number, dedendumRadius: number, centerX: number, centerY: number}} 拟合结果
     */
    fitAddendumAndDedendumCircles(points, toothCount) {
        if (points.length < 3) return null;

        // 计算中心点
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        // 计算每个点到中心的距离
        const distances = points.map(p => {
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            return Math.sqrt(dx * dx + dy * dy);
        });

        // 找到最大半径（齿顶圆）和最小半径（齿根圆）
        const maxRadius = Math.max(...distances);
        const minRadius = Math.min(...distances);

        console.log('齿顶圆和齿根圆计算:', {
            centerX: centerX.toFixed(3),
            centerY: centerY.toFixed(3),
            maxRadius: maxRadius.toFixed(3),
            minRadius: minRadius.toFixed(3),
            addendumDiameter: (maxRadius * 2).toFixed(3),
            dedendumDiameter: (minRadius * 2).toFixed(3)
        });

        return {
            addendumRadius: maxRadius,  // 最大半径 = 齿顶圆
            dedendumRadius: minRadius,  // 最小半径 = 齿根圆
            centerX,
            centerY
        };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearCircleFitting;
}

