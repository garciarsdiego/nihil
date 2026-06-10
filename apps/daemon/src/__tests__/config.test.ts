import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("applies defaults when env is unset", () => {
    const config = loadConfig({});

    expect(config.port).toBe(4517);
    expect(config.host).toBe("127.0.0.1");
    expect(config.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("honors NIHIL_DAEMON_PORT and NIHIL_DAEMON_HOST", () => {
    const config = loadConfig({
      NIHIL_DAEMON_PORT: "5000",
      NIHIL_DAEMON_HOST: "0.0.0.0",
    });

    expect(config.port).toBe(5000);
    expect(config.host).toBe("0.0.0.0");
  });

  it.each(["abc", "70000", "-1", "1.5", "0"])(
    'rejects invalid NIHIL_DAEMON_PORT "%s" with a clear error',
    (value) => {
      expect(() => loadConfig({ NIHIL_DAEMON_PORT: value })).toThrow(/NIHIL_DAEMON_PORT/);
    },
  );
});
