FROM nvidia/cuda:10.0-cudnn7-runtime-ubuntu18.04
RUN mkdir /gpt-2
WORKDIR /gpt-2
ADD . /gpt-2
RUN apt update
RUN apt-get install -y python3 python3-pip
RUN pip3 install --upgrade pip==20.0.1
RUN pip install -r requirements.txt
# Set environment variables
ENV FLASK_APP=flask_predict_api.py
ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

# Expose the application's port
EXPOSE 5000

# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]