# CardFlow

> A GitHub App built with [Probot](https://github.com/probot/probot) that 一个Github APP用于自动管理卡面

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t CardFlow .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> CardFlow
```

## Contributing

If you have suggestions for how CardFlow could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[AGPL-3](LICENSE) © 2025 Maizi-G
