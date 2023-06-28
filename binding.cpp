#include <napi.h>

#include <node_version.h>
#if CHECK_NODE_API_MODULE_VERSION && NODE_API_MODULE_VERSION == 85
#define V8_REVERSE_JSARGS
#endif

#include <errno.h>
#include <fcntl.h> 
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <termios.h>
#include <unistd.h>

#include <vector>

int set_interface_attribs(int fd, int speed) {
  struct termios tty;

  if (tcgetattr(fd, &tty) < 0) {
    return -1;
  }

  cfsetospeed(&tty, (speed_t)speed);
  cfsetispeed(&tty, (speed_t)speed);

  tty.c_cflag |= (CLOCAL | CREAD);    /* ignore modem controls */
  tty.c_cflag &= ~CSIZE;
  tty.c_cflag |= CS8;         /* 8-bit characters */
  tty.c_cflag &= ~PARENB;     /* no parity bit */
  tty.c_cflag &= ~CSTOPB;     /* only need 1 stop bit */
  tty.c_cflag &= ~CRTSCTS;    /* no hardware flowcontrol */

  /* setup for non-canonical mode */
  tty.c_iflag &= ~(IGNBRK | BRKINT | PARMRK | ISTRIP | INLCR | IGNCR | ICRNL | IXON);
  tty.c_lflag &= ~(ECHO | ECHONL | ICANON | ISIG | IEXTEN);
  tty.c_oflag &= ~OPOST;

  /* fetch bytes as they become available */
  tty.c_cc[VMIN] = 0;
  tty.c_cc[VTIME] = 5;

  if (tcsetattr(fd, TCSANOW, &tty) != 0) {
    return -1;
  }

  return 0;
}

/*
VMIN = 0, VTIME = 0
No blocking, return immediately with what is available

VMIN > 0, VTIME = 0
This will make read() always wait for bytes (exactly how many is determined by VMIN),
so read() could block indefinitely.

VMIN = 0, VTIME > 0
This is a blocking read of any number of chars with a maximum timeout (given by VTIME).
read() will block until either any amount of data is available, or the timeout occurs.

VMIN > 0, VTIME > 0
Block until either VMIN characters have been received, or VTIME after first character has elapsed.
Note that the timeout for VTIME does not begin until the first character is received.
*/
int set_blocking(int fd, int mcount) {
  struct termios tty;

  if (tcgetattr(fd, &tty) < 0) {
    return - 1;
  }

  tty.c_cc[VMIN] = mcount;
  tty.c_cc[VTIME] = 5;        /* half second timer */

  if (tcsetattr(fd, TCSANOW, &tty) < 0)
    return -1;

  return 0;
}

Napi::Value serial_open(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!info[0].IsObject()) {
    Napi::TypeError::New(env, "First argument must be an object").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object params = info[0].ToObject();

  std::string path = params.Get("path").ToString();
  int baudRate = params.Get("baudRate").ToNumber().Int32Value();

  int fd = open(path.c_str(), O_RDWR | O_NOCTTY | O_SYNC);

  if (fd < 0) {
    Napi::TypeError::New(env, "Error opening: " + path).ThrowAsJavaScriptException();
    return env.Null();
  }

  if (set_interface_attribs(fd, baudRate) < 0) {
    Napi::TypeError::New(env, "Error setting attribs").ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Number::New(env, fd);
}

Napi::Value serial_close(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // file descriptor
  if (!info[0].IsNumber()) {
    Napi::TypeError::New(env, "First argument must be an int").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  int fd = info[0].ToNumber().Int32Value();

  close(fd);

  return env.Undefined();
}

Napi::Value serial_read(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // file descriptor
  if (!info[0].IsNumber()) {
    Napi::TypeError::New(env, "First argument must be an int").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  int fd = info[0].As<Napi::Number>().Int32Value();

  std::vector<char> buffer;
  char temp[16];
  int nbytes;

  while ((nbytes = read(fd, temp, 16)) > 0) {
    for (int i = 0; i < nbytes; i++)
      buffer.push_back(temp[i]);
  }

  return Napi::Buffer<char>::Copy(env, buffer.data(), buffer.size());
}

Napi::Value serial_write(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // file descriptor
  if (!info[0].IsNumber()) {
    Napi::TypeError::New(env, "First argument must be an int").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // data
  if (!info[1].IsBuffer() && !info[1].IsString()) {
    Napi::TypeError::New(env, "First argument must be a buffer or a string").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  int fd = info[0].As<Napi::Number>().Int32Value();

  if (info[1].IsBuffer()) {
    Napi::Buffer<char> data = info[1].As<Napi::Buffer<char>>();

    int nbytes = write(fd, data.Data(), data.Length());
    return Napi::Number::New(env, nbytes);
  }

  if (info[1].IsString()) {
    std::string data = info[1].ToString(); //.Utf8Value();

    int nbytes = write(fd, data.c_str(), data.size());
    return Napi::Number::New(env, nbytes);
  }

  return Napi::Number::New(env, -1);
}

Napi::Object init(Napi::Env env, Napi::Object exports) {
  exports.Set("open", Napi::Function::New(env, serial_open));
  exports.Set("close", Napi::Function::New(env, serial_close));
  exports.Set("read", Napi::Function::New(env, serial_read));
  exports.Set("write", Napi::Function::New(env, serial_write));

  return exports;
}

NODE_API_MODULE(serial, init)

