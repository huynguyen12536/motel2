import { Module } from "@nestjs/common";
import { RabbitmqConnection } from "./rabbitmq/rabbitmq.connection.js";
@Module({ providers: [RabbitmqConnection], exports: [RabbitmqConnection] })
export class MessagingModule {}
