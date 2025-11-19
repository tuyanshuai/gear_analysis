#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DXF文件点数据提取工具
从DXF文件中提取所有POINT实体并转换为CSV格式
"""

import re
import csv
import sys

def parse_dxf_points(dxf_file_path):
    """
    解析DXF文件，提取所有POINT实体的坐标
    
    参数:
        dxf_file_path: DXF文件路径
    
    返回:
        points: 点坐标列表，每个点为(x, y, z)元组
    """
    points = []
    
    try:
        with open(dxf_file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"读取文件时出错: {e}")
        return points
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # 查找POINT实体
        if line == 'POINT':
            point_data = {}
            i += 1
            
            # 读取POINT实体的属性
            while i < len(lines):
                code_line = lines[i].strip()
                i += 1
                
                # 如果遇到新的实体开始（以0开头），停止读取当前POINT
                if code_line == '0' and i < len(lines):
                    next_line = lines[i].strip()
                    if next_line and next_line != 'POINT':
                        i -= 1  # 回退一行
                        break
                
                # 读取组码和值
                try:
                    code = int(code_line)
                except ValueError:
                    continue
                
                if i >= len(lines):
                    break
                
                value_line = lines[i].strip()
                i += 1
                
                # 提取坐标
                if code == 10:  # X坐标
                    try:
                        point_data['x'] = float(value_line)
                    except ValueError:
                        pass
                elif code == 20:  # Y坐标
                    try:
                        point_data['y'] = float(value_line)
                    except ValueError:
                        pass
                elif code == 30:  # Z坐标
                    try:
                        point_data['z'] = float(value_line)
                    except ValueError:
                        pass
                
                # 如果已经读取了X和Y坐标，可以保存点（Z坐标可选）
                if 'x' in point_data and 'y' in point_data:
                    x = point_data['x']
                    y = point_data['y']
                    z = point_data.get('z', 0.0)
                    points.append((x, y, z))
                    break  # 找到完整的点，继续查找下一个
        else:
            i += 1
    
    return points

def save_points_to_csv(points, csv_file_path):
    """
    将点数据保存为CSV文件
    
    参数:
        points: 点坐标列表
        csv_file_path: 输出CSV文件路径
    """
    try:
        with open(csv_file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            # 写入表头
            writer.writerow(['X', 'Y', 'Z'])
            # 写入点数据
            for point in points:
                writer.writerow(point)
        print(f"成功提取 {len(points)} 个点，已保存到: {csv_file_path}")
    except Exception as e:
        print(f"保存CSV文件时出错: {e}")

def main():
    # 输入和输出文件路径
    dxf_file = '25-100刚轮-点.dxf'
    csv_file = '25-100刚轮-点.csv'
    
    print(f"正在解析DXF文件: {dxf_file}")
    points = parse_dxf_points(dxf_file)
    
    if points:
        print(f"找到 {len(points)} 个点")
        save_points_to_csv(points, csv_file)
    else:
        print("未找到任何点数据")

if __name__ == '__main__':
    main()
