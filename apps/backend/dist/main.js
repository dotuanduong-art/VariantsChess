"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_js_1 = require("./app.module.js");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_js_1.AppModule);
    app.enableCors({
        origin: ['http://localhost:3000'],
        credentials: true,
    });
    await app.listen(3001);
    console.log('🚀 Backend running on http://localhost:3001');
}
bootstrap();
//# sourceMappingURL=main.js.map