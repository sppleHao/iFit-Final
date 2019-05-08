# iFit-Final
第十二届“英特尔杯”全国大学生软件创新大赛iFit项目决赛作品

## Descriptions
“i Fit” 应用是一款使用了web端深度学习框架的健身应用，有别于市面上的健身app，
“i Fit”实现和用户的实时交互，让健身不再枯燥无聊。

## Demo

* [Try iFit Demo ！](https://139.196.138.230:1234)

    未注册域名，所以可能有安全警告

## Folder Structure
* src/html: iFit 应用网页
    * index.html 应用首页
    * teach.html 教学模式
    * test.html 实战模式
    * model.html 模型教学模式
* src/script:
    * net/: iFit深度网络
        * iFitNet: iFitNet姿态估计网络
        * 3D pose: 3D模型网络
    * utils/: 工具文件夹
    * config.js 配置文件
    * train.js 视频预训练
    * teach.js 教学模式
    * test.js 实战模式
    * model.js 模型教学模式
## Usage
### 0.(可选)下载[iFit后端GitHub](https://github.com/sppleHao/weight)

### 1.克隆仓库到本地
```sh
git clone https://github.com/sppleHao/iFit-Final.git
```

### 3.cd到iFit-Final文件夹下
```sh
cd iFit-Final
```

### 4.下载依赖

```sh
npm install
```

### 5.配置config.js (在 src/script 文件夹下)

#### 5.1 若下载了后端，则开启后端后

    const GLOBAL = {
        ... 
        ENVIRONMENT_BACK:'dev',
        ...
    }
   
#### 5.2 没下载后端

    const GLOBAL = {
        ... 
        ENVIRONMENT_BACK:'build',
        ...
    }

### 6.打开前端

```sh
node parcel-start.js
```
## Networks
### 1. Architecture
### 2. Results

## Acknowledgments
