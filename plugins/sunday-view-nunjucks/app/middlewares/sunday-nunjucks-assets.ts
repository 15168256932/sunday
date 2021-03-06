import { MiddlewareItemConfig, BaseApplication } from '../../../../definitions/core';
import { Context, Next } from 'koa';
import * as fs from 'fs-extra';
import * as path from 'path';
import { getConfig } from '../lib/util';
import * as util from 'util';
import url = require('url');
import http = require('http');
const fileNameReg = /nunjucks\/(.+)/;

const readFile = util.promisify(fs.readFile);

const factory = function(config:MiddlewareItemConfig, app:BaseApplication) {
    const mode = app.config.mode;
    return async function(ctx: Context, next: Next) {
        const urlPath = ctx.path;
        const match = urlPath.match(fileNameReg);
        if (match === null) {
            await next();
        }
        const [root, js, css] = getConfig(app);
        const fileName = match![1];
        const isJs = /\.js$/.test(fileName);
        const realName = fileName.replace(/_[^_\.]+\.(js|css)$/, '.$1');
        if (mode === 'prod') {
            try {
                const reflect = fs.readJSONSync(path.resolve(root, isJs ? js : css));
                if (!reflect) {
                    await next();
                }
                const content = await readFile(reflect[realName].path);
                // 游览器当只有收到响应头为 text/css的link时才会重新渲染样式
                ctx.set('Content-Type', isJs ? 'application/javascript' : 'text/css')
                ctx.body = content;
            }catch {
                ctx.status = 404;
                ctx.body = 'Not Found';
            }
        } else {
            const { hostname, port, protocol, publicPath } = config;
            // 兼容window路径
            const dest = url.format({
                hostname,
                port,
                protocol,
                pathname: path.join(publicPath, realName).replace(/\\/g, '/')
            });
            ctx.redirect(dest);
        }
    }
}

export = factory;