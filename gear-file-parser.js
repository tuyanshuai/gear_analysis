/**
 * 文件解析模块
 * 处理轮廓文件和DXF文件的解析
 */

class GearFileParser {
    /**
     * 按角度排序点（相对于中心点）
     * @param {Array<{x: number, y: number}>} points - 点数组
     * @returns {Array<{x: number, y: number}>} 排序后的点数组
     */
    sortPointsByAngle(points) {
        if (points.length === 0) return points;

        // 计算中心点
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        // 计算每个点的角度并排序
        return points.map(point => {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            const angle = Math.atan2(dy, dx);
            return { ...point, angle };
        }).sort((a, b) => a.angle - b.angle).map(({ angle, ...point }) => point);
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

        // 按角度排序
        return this.sortPointsByAngle(points);
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

        // 按角度排序
        return this.sortPointsByAngle(points);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearFileParser;
}

