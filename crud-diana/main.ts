import { Application, Router, Status } from "https://deno.land/x/oak/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import { Client } from "https://deno.land/x/mysql/mod.ts";
import * as yup from "https://cdn.pika.dev/yup@^0.29.1";

const env = await config({ safe: true });

const client = await new Client().connect({
  hostname: env["HOSTNAME"],
  username: env["USERNAME"],
  password: env["PASSWORD"],
});

await client.execute("CREATE DATABASE IF NOT EXISTS diana");
await client.execute("USE diana");
await client.execute(`CREATE TABLE IF NOT EXISTS dinosaur (
    id int(11) NOT NULL AUTO_INCREMENT,
    name varchar(100) NOT NULL,
    image varchar(50) NOT NULL,
    power varchar(50) NOT NULL,
    PRIMARY KEY (id)
  );
`);

const dinasaurSchema = yup.object().shape({
  name: yup.string().trim().min(3).required(),
  image: yup.string().url().required(),
  power: yup.string().min(4).required(),
});

const dinasaurUpdateSchema = yup.object().shape({
  id: yup.number().max(100).required(),
  name: yup.string().trim().min(3),
  image: yup.string().url(),
  power: yup.string().min(4),
});

const app = new Application();
const router = new Router();

router
  .get("/", (ctx) => {
    ctx.response.body = {
      message: "OK",
      status: 200,
    };
  });

router.get("/dino", async (ctx) => {
  try {
    const allDiana = await client.query("SELECT * FROM dinosaur");
    ctx.response.status = Status.OK;
    ctx.response.body = allDiana;
  } catch (error) {
    throw error;
  }
});

router.get("/dino/:id", async (ctx) => {
  try {
    const cleanId = ctx.params.id;
    if (cleanId?.match(/d+$/)) {
      ctx.response.status = Status.UnprocessableEntity;
      throw new Error("Invalid param type");
    }

    const diana = await client.query(
      "SELECT * FROM dinosaur WHERE id = ?",
      [Number(cleanId)],
    );

    ctx.response.status = Status.OK;
    ctx.response.body = diana;
  } catch (error) {
    console.error(error.stack);
    throw error;
  }
});

router.post("/dino", async (ctx) => {
  try {
    if (!ctx.request.hasBody) {
      ctx.response.status = Status.UnprocessableEntity;
      throw new Error("Provide JSON body");
    }

    const body = await ctx.request.body();
    const value = body.value;
    const dino = await dinasaurSchema.validate(value);

    await client.execute(
      "INSERT INTO dinosaur (name, image, power) values(?,?,?)",
      [dino?.name, dino?.image, dino?.power],
    );

    ctx.response.status = Status.OK;
    ctx.response.body = {
      message: "Created",
    };
  } catch (error) {
    console.error(error.stack);

    throw error;
  }
});

router.delete("/dino/:id", async (ctx) => {
  try {
    const cleanId = ctx.params.id;
    if (cleanId?.match(/d+$/)) {
      ctx.response.status = Status.UnprocessableEntity;
      throw new Error("Invalid param type");
    }

    await client.execute(
      "DELETE FROM dinosaur WHERE id = ?",
      [Number(cleanId)],
    );

    ctx.response.status = Status.OK;
    ctx.response.body = {
      message: "Deleted",
    };
  } catch (error) {
    throw error;
  }
});

router.put("/dino", async (ctx) => {
  try {
    if (!ctx.request.hasBody) {
      ctx.response.status = Status.UnprocessableEntity;
      throw new Error("Provide JSON body");
    }

    const body = await ctx.request.body();
    const value = body.value;

    const dino = await dinasaurUpdateSchema.validate(value);
    const dinoId = dino?.id;

    const keys = Object.keys(value).filter((k) => k != "id");

    const updatePayload = keys.map((k) => `${k} = "${value[k]}"`);

    await client.execute(
      `UPDATE dinosaur SET ${updatePayload.join(", ")}  WHERE id=${dinoId}`,
    );

    ctx.response.status = Status.OK;
    ctx.response.body = {
      message: "Updated",
    };
  } catch (error) {
    throw error;
  }
});

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (err.name === "ValidationError") {
      ctx.response.status = Status.UnprocessableEntity;
    }

    ctx.response.status = ctx.response.status || 500;
    ctx.response.body = {
      message: err.message,
    };
  }
});

app.use(router.allowedMethods());
app.use(router.routes());

console.log(`Listening on port ${env["PORT"]}`);

await app.listen({ port: parseInt(env["PORT"]) });
