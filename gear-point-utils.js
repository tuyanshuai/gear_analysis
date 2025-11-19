/**
 * 点云工具模块
 * 提供点云数据的处理工具函数
 */

class GearPointUtils {
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
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearPointUtils;
}

